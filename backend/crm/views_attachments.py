from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from crm.models import Card, Attachment, BoardMember
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
