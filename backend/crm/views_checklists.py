from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from crm.models import Checklist, ChecklistItem
from crm.serializers import ChecklistSerializer, ChecklistItemSerializer
from crm.utils import broadcast_to_board


class ChecklistViewSet(viewsets.ModelViewSet):
    queryset = Checklist.objects.all()
    serializer_class = ChecklistSerializer
    
    def create(self, request, *args, **kwargs):
        """Create a new checklist for a card"""
        card_id = request.data.get('card_id')
        name = request.data.get('name', 'Checklist')
        
        # Get the position (last position + 1)
        last_checklist = Checklist.objects.filter(card_id=card_id).order_by('-position').first()
        position = (last_checklist.position + 1) if last_checklist else 0
        
        checklist = Checklist.objects.create(
            card_id=card_id,
            name=name,
            position=position
        )
        
        serializer = self.get_serializer(checklist)
        
        # Broadcast WebSocket event
        board_id = checklist.card.list.board.id
        broadcast_to_board(board_id, 'checklist_created', {
            'checklist': serializer.data,
            'card_id': card_id,
            'user_id': request.user.id if hasattr(request, 'user') else None
        })
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        """Update checklist name"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Broadcast WebSocket event
        board_id = instance.card.list.board.id
        broadcast_to_board(board_id, 'checklist_updated', {
            'checklist': serializer.data,
            'card_id': instance.card.id,
            'user_id': request.user.id if hasattr(request, 'user') else None
        })
        
        return Response(serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        """Delete a checklist"""
        instance = self.get_object()
        board_id = instance.card.list.board.id
        checklist_id = instance.id
        card_id = instance.card.id
        
        self.perform_destroy(instance)
        
        # Broadcast WebSocket event
        broadcast_to_board(board_id, 'checklist_deleted', {
            'checklist_id': checklist_id,
            'card_id': card_id,
            'user_id': request.user.id if hasattr(request, 'user') else None
        })
        
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChecklistItemViewSet(viewsets.ModelViewSet):
    queryset = ChecklistItem.objects.all()
    serializer_class = ChecklistItemSerializer
    
    def create(self, request, *args, **kwargs):
        """Create a new checklist item"""
        checklist_id = request.data.get('checklist_id')
        text = request.data.get('text')
        
        # Get the position (last position + 1)
        last_item = ChecklistItem.objects.filter(checklist_id=checklist_id).order_by('-position').first()
        position = (last_item.position + 1) if last_item else 0
        
        item = ChecklistItem.objects.create(
            checklist_id=checklist_id,
            text=text,
            position=position
        )
        
        serializer = self.get_serializer(item)
        
        # Broadcast WebSocket event
        board_id = item.checklist.card.list.board.id
        broadcast_to_board(board_id, 'checklist_item_created', {
            'item': serializer.data,
            'checklist_id': checklist_id,
            'card_id': item.checklist.card.id,
            'user_id': request.user.id if hasattr(request, 'user') else None
        })
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        """Update checklist item (text or completed status)"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Broadcast WebSocket event
        board_id = instance.checklist.card.list.board.id
        broadcast_to_board(board_id, 'checklist_item_updated', {
            'item': serializer.data,
            'checklist_id': instance.checklist.id,
            'card_id': instance.checklist.card.id,
            'user_id': request.user.id if hasattr(request, 'user') else None
        })
        
        return Response(serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        """Delete a checklist item"""
        instance = self.get_object()
        board_id = instance.checklist.card.list.board.id
        item_id = instance.id
        checklist_id = instance.checklist.id
        card_id = instance.checklist.card.id
        
        self.perform_destroy(instance)
        
        # Broadcast WebSocket event
        broadcast_to_board(board_id, 'checklist_item_deleted', {
            'item_id': item_id,
            'checklist_id': checklist_id,
            'card_id': card_id,
            'user_id': request.user.id if hasattr(request, 'user') else None
        })
        
        return Response(status=status.HTTP_204_NO_CONTENT)
