import os
import mimetypes
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.http import FileResponse

from crm.models import Card, Attachment
from crm.serializers import AttachmentSerializer
from crm.auth import CsrfExemptSessionAuthentication
from crm.permissions import user_can_access_board

class AttachmentUploadView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, card_id):
        card = get_object_or_404(Card, id=card_id)
        board = card.list.board

        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=400)

        # ── C-2 FIX: Validate file extension & size on upload
        ext = os.path.splitext(file.name)[1].lower()
        dangerous_extensions = ['.exe', '.bat', '.cmd', '.sh', '.js', '.html', '.htm', '.svg', '.swf']
        if ext in dangerous_extensions:
            return Response({'error': 'File type not allowed.'}, status=400)

        if file.size > 50 * 1024 * 1024:  # 50MB limit
            return Response({'error': 'File size must be less than 50MB'}, status=400)

        attachment = Attachment.objects.create(
            card=card,
            file=file,
            uploaded_by=request.user
        )

        return Response(AttachmentSerializer(attachment).data, status=201)


class AttachmentDetailView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, attachment_id):
        attachment = get_object_or_404(Attachment, id=attachment_id)
        card = attachment.card
        board = card.list.board

        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)

        # Delete the file from filesystem
        if attachment.file:
            attachment.file.delete()

        attachment.delete()
        return Response({'status': 'deleted'}, status=204)


class AttachmentDownloadView(APIView):
    """
    ── H-2 FIX: Authenticated media download view that verifies board access.
    Also acts as a mitigation for C-2 by forcing content-disposition header to prevent inline XSS.
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, attachment_id):
        attachment = get_object_or_404(Attachment, id=attachment_id)
        board = attachment.card.list.board

        if not user_can_access_board(request.user, board, min_role='VIEWER'):
            return Response({'error': 'forbidden'}, status=403)

        if not attachment.file:
            return Response({'error': 'File not found'}, status=404)

        try:
            # Guess MIME type
            content_type, _ = mimetypes.guess_type(attachment.file.name)
            if not content_type:
                content_type = 'application/octet-stream'

            # Define safe image types that can be opened inline
            safe_images = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
            
            response = FileResponse(attachment.file.open(), content_type=content_type)
            
            # Force download for everything except safe image types to mitigate Stored XSS
            if content_type in safe_images:
                response['Content-Disposition'] = f'inline; filename="{attachment.filename}"'
            else:
                response['Content-Disposition'] = f'attachment; filename="{attachment.filename}"'
                
            return response
        except Exception as e:
            return Response({'error': f'Failed to retrieve file: {str(e)}'}, status=500)
