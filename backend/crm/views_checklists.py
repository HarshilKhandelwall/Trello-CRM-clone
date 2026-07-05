from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from crm.auth import CsrfExemptSessionAuthentication
from crm.models import Checklist, ChecklistItem, Card
from crm.serializers import ChecklistSerializer, ChecklistItemSerializer
from crm.utils import broadcast_to_board
from crm.permissions import user_can_access_board
from django.shortcuts import get_object_or_404


class ChecklistViewSet(viewsets.ModelViewSet):
    queryset = Checklist.objects.all()
    serializer_class = ChecklistSerializer
    # ── C-3: explicit auth/permission classes (previously inherited DRF defaults)
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        """Create a new checklist for a card"""
        card_id = request.data.get('card_id')
        name = request.data.get('name', 'Checklist')

        # ── C-4 FIX: validate card exists and check board-level RBAC
        card = get_object_or_404(Card, id=card_id) if card_id else None
        if card is None:
            return Response({'error': 'card_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        board = card.list.board
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=status.HTTP_403_FORBIDDEN)

        # Get the position (last position + 1)
        last_checklist = Checklist.objects.filter(card=card).order_by('-position').first()
        position = (last_checklist.position + 1) if last_checklist else 0

        checklist = Checklist.objects.create(
            card=card,
            name=name,
            position=position
        )

        serializer = self.get_serializer(checklist)

        # Broadcast WebSocket event
        broadcast_to_board(board.id, 'checklist_created', {
            'checklist': serializer.data,
            'card_id': card.id,
            'user_id': request.user.id
        })

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Update checklist name"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # ── C-4 FIX: board-level RBAC
        board = instance.card.list.board
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # Broadcast WebSocket event
        broadcast_to_board(board.id, 'checklist_updated', {
            'checklist': serializer.data,
            'card_id': instance.card.id,
            'user_id': request.user.id
        })

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """Delete a checklist"""
        instance = self.get_object()

        # ── C-4 FIX: board-level RBAC
        board = instance.card.list.board
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=status.HTTP_403_FORBIDDEN)

        board_id = board.id
        checklist_id = instance.id
        card_id = instance.card.id

        self.perform_destroy(instance)

        # Broadcast WebSocket event
        broadcast_to_board(board_id, 'checklist_deleted', {
            'checklist_id': checklist_id,
            'card_id': card_id,
            'user_id': request.user.id
        })

        return Response(status=status.HTTP_204_NO_CONTENT)


class ChecklistItemViewSet(viewsets.ModelViewSet):
    queryset = ChecklistItem.objects.all()
    serializer_class = ChecklistItemSerializer
    # ── C-3: explicit auth/permission classes
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        """Create a new checklist item"""
        checklist_id = request.data.get('checklist_id')
        text = request.data.get('text')

        # ── C-4 FIX: validate checklist exists and check board-level RBAC
        checklist = get_object_or_404(Checklist, id=checklist_id) if checklist_id else None
        if checklist is None:
            return Response({'error': 'checklist_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        if not text or not str(text).strip():
            return Response({'error': 'text is required'}, status=status.HTTP_400_BAD_REQUEST)

        board = checklist.card.list.board
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=status.HTTP_403_FORBIDDEN)

        # Get the position (last position + 1)
        last_item = ChecklistItem.objects.filter(checklist=checklist).order_by('-position').first()
        position = (last_item.position + 1) if last_item else 0

        item = ChecklistItem.objects.create(
            checklist=checklist,
            text=str(text).strip(),
            position=position
        )

        serializer = self.get_serializer(item)

        # Broadcast WebSocket event
        broadcast_to_board(board.id, 'checklist_item_created', {
            'item': serializer.data,
            'checklist_id': checklist.id,
            'card_id': checklist.card.id,
            'user_id': request.user.id
        })

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Update checklist item (text or completed status)"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # ── C-4 FIX: board-level RBAC
        board = instance.checklist.card.list.board
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # Broadcast WebSocket event
        broadcast_to_board(board.id, 'checklist_item_updated', {
            'item': serializer.data,
            'checklist_id': instance.checklist.id,
            'card_id': instance.checklist.card.id,
            'user_id': request.user.id
        })

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """Delete a checklist item"""
        instance = self.get_object()

        # ── C-4 FIX: board-level RBAC
        board = instance.checklist.card.list.board
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=status.HTTP_403_FORBIDDEN)

        board_id = board.id
        item_id = instance.id
        checklist_id = instance.checklist.id
        card_id = instance.checklist.card.id

        self.perform_destroy(instance)

        # Broadcast WebSocket event
        broadcast_to_board(board_id, 'checklist_item_deleted', {
            'item_id': item_id,
            'checklist_id': checklist_id,
            'card_id': card_id,
            'user_id': request.user.id
        })

        return Response(status=status.HTTP_204_NO_CONTENT)
