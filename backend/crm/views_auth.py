import random
import string
import hashlib
from datetime import datetime, timedelta

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authentication import SessionAuthentication
from crm.auth import CsrfExemptSessionAuthentication
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.utils.decorators import method_decorator
from django.core.mail import send_mail
from django.conf import settings
from crm.serializers import UserSerializer

from rest_framework.throttling import AnonRateThrottle

User = get_user_model()


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


def _generate_otp(length=6):
    """Return a random numeric OTP string."""
    return ''.join(random.choices(string.digits, k=length))


def _hash_otp(otp: str) -> str:
    """Return a SHA-256 hex digest of the OTP string.
    Stored in the session instead of the plaintext OTP (C-6 fix).
    """
    return hashlib.sha256(otp.encode()).hexdigest()


def _send_otp_email(otp, username):
    """Send OTP to the hardcoded superadmin email."""
    recipient = settings.SUPERADMIN_OTP_EMAIL
    subject = "Your CRM Login Verification Code"
    message = (
        f"A login attempt was made for account: {username}\n\n"
        f"Your verification code is:\n\n"
        f"    {otp}\n\n"
        f"This code expires in 10 minutes.\n"
        f"If you did not attempt to log in, please contact your administrator immediately."
    )
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [recipient],
        fail_silently=False,
    )


@method_decorator(ensure_csrf_cookie, name='dispatch')
class RegisterView(APIView):
    """User creation endpoint — restricted to superusers/staff only (no self-registration)"""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not (request.user.is_superuser or request.user.is_staff):
            return Response(
                {'error': 'Only administrators can create user accounts'},
                status=status.HTTP_403_FORBIDDEN
            )

        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')

        if not username or not password:
            return Response(
                {'error': 'Username and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── M-8 FIX: Generic error message to prevent username/email enumeration
        if User.objects.filter(username=username).exists() or (email and User.objects.filter(email=email).exists()):
            return Response(
                {'error': 'Registration failed: Username or email already in use'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )

        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    Step 1 of 2-step login.
    Validates credentials, generates OTP, emails it to the superadmin address,
    and stores the pending state in the session.
    Does NOT create a login session — that only happens after OTP verification.
    """
    # ── M-5 FIX: Remove @csrf_exempt and use CsrfExemptSessionAuthentication
    # This prevents CSRF attacks by ensuring the X-CSRFToken header is validated
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response(
                {'error': 'Username and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(request, username=username, password=password)

        if user is None:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # ── C-6 FIX: store a SHA-256 hash, never the plaintext OTP
        otp = _generate_otp()
        expiry = datetime.utcnow() + timedelta(seconds=settings.OTP_EXPIRY_SECONDS)

        request.session['otp_pending'] = {
            'otp_hash': _hash_otp(otp),
            'user_id': user.id,
            'username': user.username,
            'expires_at': expiry.isoformat(),
            'attempts': 0,  # C-2 FIX: track failed attempts
            'last_sent_at': datetime.utcnow().isoformat(),  # H-9 FIX: rate limit resends
        }
        request.session.modified = True

        # Email the OTP to the hardcoded superadmin address
        try:
            _send_otp_email(otp, user.username)
        except Exception as e:
            # Clear the pending session so the user isn't stuck
            request.session.pop('otp_pending', None)
            return Response(
                {'error': f'Failed to send verification email: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        return Response(
            {
                'otp_required': True,
                'message': f'A verification code has been sent to the administrator email.',
                'destination': settings.SUPERADMIN_OTP_EMAIL,
            },
            status=status.HTTP_200_OK
        )


class VerifyOtpView(APIView):
    """
    Step 2 of 2-step login.
    Checks the OTP stored in session. On success, creates the user session.
    """
    # ── M-5 FIX: Remove @csrf_exempt and use CsrfExemptSessionAuthentication
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        otp_input = request.data.get('otp', '').strip()
        pending = request.session.get('otp_pending')

        if not pending:
            return Response(
                {'error': 'No pending verification. Please log in again.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check expiry
        expires_at = datetime.fromisoformat(pending['expires_at'])
        if datetime.utcnow() > expires_at:
            request.session.pop('otp_pending', None)
            return Response(
                {'error': 'Verification code has expired. Please log in again.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── C-2 FIX: check OTP match using the stored hash
        submitted_hash = _hash_otp(otp_input)
        if submitted_hash != pending['otp_hash']:
            # Increment failed attempt counter
            pending['attempts'] = pending.get('attempts', 0) + 1
            request.session['otp_pending'] = pending
            request.session.modified = True

            remaining = max(0, 5 - pending['attempts'])
            if pending['attempts'] >= 5:
                request.session.pop('otp_pending', None)
                return Response(
                    {'error': 'Too many failed attempts. Please log in again.'},
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )
            return Response(
                {'error': f'Invalid verification code. {remaining} attempt(s) remaining.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # OTP correct — create session
        try:
            user = User.objects.get(id=pending['user_id'])
        except User.DoesNotExist:
            request.session.pop('otp_pending', None)
            return Response(
                {'error': 'User no longer exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        request.session.pop('otp_pending', None)
        login(request, user)

        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ResendOtpView(APIView):
    """
    Generates a fresh OTP and re-emails it.
    Requires an active pending session from a prior /login/ call.
    """
    # ── M-5 FIX: Remove @csrf_exempt and use CsrfExemptSessionAuthentication
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        pending = request.session.get('otp_pending')

        if not pending:
            return Response(
                {'error': 'No pending verification. Please log in again.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── H-9 FIX: rate limit resends to prevent email spam/session fixation abuse
        now = datetime.utcnow()
        last_sent_str = pending.get('last_sent_at')
        if last_sent_str:
            last_sent = datetime.fromisoformat(last_sent_str)
            if (now - last_sent).total_seconds() < 60:
                return Response(
                    {'error': 'Please wait 60 seconds before resending.'},
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )

        # ── C-6 FIX: store hash, never plaintext
        otp = _generate_otp()
        expiry = now + timedelta(seconds=settings.OTP_EXPIRY_SECONDS)

        pending['otp_hash'] = _hash_otp(otp)
        # Remove legacy plaintext key if present
        pending.pop('otp', None)
        pending['expires_at'] = expiry.isoformat()
        pending['attempts'] = 0  # C-2: reset attempt counter on resend
        pending['last_sent_at'] = now.isoformat()
        request.session['otp_pending'] = pending
        request.session.modified = True

        try:
            _send_otp_email(otp, pending['username'])
        except Exception as e:
            return Response(
                {'error': f'Failed to resend verification email: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        return Response(
            {'message': 'A new verification code has been sent.'},
            status=status.HTTP_200_OK
        )


class LogoutView(APIView):
    """User logout endpoint"""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(
            {'message': 'Logged out successfully'},
            status=status.HTTP_200_OK
        )


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CurrentUserView(APIView):
    """Get current authenticated user"""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class GetCSRFTokenView(APIView):
    """Get CSRF token for frontend — returns token in body + header for cross-origin dev."""
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        from django.middleware.csrf import get_token
        token = get_token(request)
        response = Response({'csrfToken': token}, status=status.HTTP_200_OK)
        # Also expose it as a header so JS can read it even when cookie is cross-origin
        response['X-CSRFToken'] = token
        return response
