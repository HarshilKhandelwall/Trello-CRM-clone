from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from crm.models import Board, Label
from crm.serializers_labels import LabelSerializer
from crm.auth import CsrfExemptSessionAuthentication
from crm.permissions import user_can_access_board


class LabelListCreateView(APIView):
    """
    GET  /api/boards/{board_id}/labels/  — list all global labels
    POST /api/boards/{board_id}/labels/  — create a global label (board_id used for auth only)
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, board_id):
        board = get_object_or_404(Board, id=board_id)
        if not user_can_access_board(request.user, board, min_role='VIEWER'):
            return Response({'error': 'forbidden'}, status=403)
        # Return ALL global labels
        labels = Label.objects.all()
        serializer = LabelSerializer(labels, many=True)
        return Response(serializer.data)

    def post(self, request, board_id):
        board = get_object_or_404(Board, id=board_id)
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)

        serializer = LabelSerializer(data=request.data)
        if serializer.is_valid():
            # get_or_create to avoid duplicate name+color combos
            label, _ = Label.objects.get_or_create(
                name=serializer.validated_data['name'],
                color=serializer.validated_data['color'],
            )
            return Response(LabelSerializer(label).data, status=201)
        return Response(serializer.errors, status=400)


class LabelUpdateDeleteView(APIView):
    """
    PATCH  /api/labels/{label_id}/  — update a global label
    DELETE /api/labels/{label_id}/  — delete a global label
    Any authenticated EDITOR+ user can manage labels.
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, label_id):
        # ── C-1 FIX: Only administrators can modify global labels
        if not (request.user.is_superuser or request.user.is_staff):
            return Response({'error': 'Only administrators can modify global labels'}, status=403)

        label = get_object_or_404(Label, id=label_id)
        serializer = LabelSerializer(label, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, label_id):
        # ── C-1 FIX: Only administrators can delete global labels
        if not (request.user.is_superuser or request.user.is_staff):
            return Response({'error': 'Only administrators can delete global labels'}, status=403)

        label = get_object_or_404(Label, id=label_id)
        label.delete()
        return Response(status=204)
