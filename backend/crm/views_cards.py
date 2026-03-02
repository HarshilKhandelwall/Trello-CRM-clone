from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication
from django.shortcuts import get_object_or_404
from django.db import transaction
from crm.models import Card, List, BoardMember
from crm.serializers import CardSerializer
from crm.utils import log_activity
from crm.permissions import user_can_access_board


class CreateCardView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        title = request.data.get('title')
        list_id = request.data.get('list')

        if not title or not list_id:
            return Response({'error': 'title and list are required'}, status=400)

        lst = get_object_or_404(List, id=list_id)
        board = lst.board

        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)

        card = Card.objects.create(
            title=title,
            list=lst,
            created_by=request.user,
        )
        
        # Log activity
        log_activity(
            board=board,
            user=request.user,
            action_type='card_created',
            description=f'added "{card.title}" to {lst.name}',
            card=card,
            list_obj=lst
        )
        
        # Broadcast WebSocket event
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board.id}',
            {
                'type': 'card_created',
                'card_data': CardSerializer(card).data,
                'list_id': lst.id,
                'user_id': request.user.id,
                'username': request.user.username
            }
        )

        return Response(CardSerializer(card).data, status=201)


class CardDetailView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, card_id):
        card = get_object_or_404(Card, id=card_id)
        board = card.list.board

        if not user_can_access_board(request.user, board, min_role='VIEWER'):
            return Response({'error': 'forbidden'}, status=403)

        return Response(CardSerializer(card).data)

    def patch(self, request, card_id):
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        card = get_object_or_404(Card, id=card_id)
        board = card.list.board

        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)

        serializer = CardSerializer(card, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        # Log activity
        log_activity(
            board=board,
            user=request.user,
            action_type='card_updated',
            description=f'updated "{card.title}"',
            card=card
        )
        
        # Broadcast WebSocket event
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board.id}',
            {
                'type': 'card_updated',
                'card_data': serializer.data,
                'user_id': request.user.id,
                'username': request.user.username
            }
        )
        
        return Response(serializer.data)

    def delete(self, request, card_id):
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from django.db import connection
        
        card = get_object_or_404(Card, id=card_id)
        board = card.list.board
        list_id = card.list.id

        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)

        card_id_to_delete = card.id
        card_title = card.title
        
        # SQLite FK workaround: Disable FK checks for this specific deletion
        # This is necessary because of circular dependencies and CASCADE issues in SQLite
        with connection.cursor() as cursor:
            # Turn off FK constraints
            cursor.execute("PRAGMA foreign_keys = OFF")
            
            try:
                # Delete the card - CASCADE will delete related objects
                card.delete()
            finally:
                # Always re-enable FK constraints
                cursor.execute("PRAGMA foreign_keys = ON")
        
        # Log activity AFTER deletion (don't reference the deleted card)
        log_activity(
            board=board,
            user=request.user,
            action_type='card_deleted',
            description=f'deleted "{card_title}"',
            metadata={'card_id': card_id_to_delete, 'card_title': card_title}
        )
        
        # Broadcast WebSocket event
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board.id}',
            {
                'type': 'card_deleted',
                'card_id': card_id_to_delete,
                'list_id': list_id,
                'user_id': request.user.id,
                'username': request.user.username
            }
        )
        
        return Response({'status': 'deleted'}, status=204)


class MoveCardView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        card_id = request.data.get('card_id')
        to_list_id = request.data.get('to_list')

        if not card_id or not to_list_id:
            return Response({'error': 'card_id and to_list required'}, status=400)

        card = get_object_or_404(Card, id=card_id)
        old_list_id = card.list.id
        to_list = get_object_or_404(List, id=to_list_id)
        board = card.list.board

        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)

        # Update card list (position is not a field on Card model)
        card.list = to_list
        card.save(update_fields=['list'])
        
        # Log activity
        old_list = get_object_or_404(List, id=old_list_id)
        log_activity(
            board=board,
            user=request.user,
            action_type='card_moved',
            description=f'moved "{card.title}" from {old_list.name} to {to_list.name}',
            card=card,
            list_obj=to_list,
            metadata={'from_list_id': old_list_id, 'to_list_id': to_list.id}
        )
        
        # Broadcast WebSocket event
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board.id}',
            {
                'type': 'card_moved',
                'card_id': card.id,
                'from_list_id': old_list_id,
                'to_list_id': to_list.id,
                'card_data': CardSerializer(card).data,
                'user_id': request.user.id,
                'username': request.user.username
            }
        )

        return Response(CardSerializer(card).data)


class CopyCardView(APIView):
    """Copy a card with all its details to the same or different list"""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, card_id):
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        # Get source card
        source_card = get_object_or_404(Card, id=card_id)
        board = source_card.list.board

        # Check permissions
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)
        
        # Get target list (default to same list)
        target_list_id = request.data.get('list_id', source_card.list.id)
        target_list = get_object_or_404(List, id=target_list_id)
        
        # Ensure target list is on same board
        if target_list.board.id != board.id:
            return Response({'error': 'Cannot copy card to different board'}, status=400)
        
        # Get new title (default adds " (copy)" suffix)
        new_title = request.data.get('title', f'{source_card.title} (copy)')
        keep_members = request.data.get('keep_members', True)
        keep_labels = request.data.get('keep_labels', True)
        keep_checklists = request.data.get('keep_checklists', True)
        
        # Create new card
        new_card = Card.objects.create(
            title=new_title,
            description=source_card.description,
            email=source_card.email,
            phone=source_card.phone,
            due_at=source_card.due_at,
            list=target_list,
            created_by=request.user
        )
        
        # Copy members
        if keep_members:
            for member in source_card.members.all():
                new_card.members.add(member)
        
        # Copy labels
        if keep_labels:
            for label in source_card.labels.all():
                new_card.labels.add(label)
        
        # Copy checklists
        if keep_checklists:
            from crm.models import Checklist, ChecklistItem
            for checklist in source_card.checklists.all():
                new_checklist = Checklist.objects.create(
                    card=new_card,
                    name=checklist.name,
                    position=checklist.position
                )
                # Copy checklist items
                for item in checklist.items.all():
                    ChecklistItem.objects.create(
                        checklist=new_checklist,
                        text=item.text,
                        completed=False,  # Reset completion status
                        position=item.position
                    )
        
        # Log activity
        log_activity(
            board=board,
            user=request.user,
            action_type='card_created',
            description=f'copied "{source_card.title}" to "{new_title}" in {target_list.name}',
            card=new_card,
            list_obj=target_list,
            metadata={'copied_from_card_id': card_id}
        )
        
        # Broadcast WebSocket event
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board.id}',
            {
                'type': 'card_created',
                'card_data': CardSerializer(new_card).data,
                'list_id': target_list.id,
                'user_id': request.user.id,
                'username': request.user.username
            }
        )
        
        serializer = CardSerializer(new_card)
        return Response(serializer.data, status=201)


class MoveCardToBoardView(APIView):
    """Move a card to any list on any board (cross-board, cross-workspace).
    POST /api/cards/{card_id}/move-to-board/
    Body: { "list_id": <target_list_id> }
    - Card members are cleared (they may not be members of the destination board)
    - Labels are preserved (labels are now global)
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, card_id):
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        card = get_object_or_404(Card, id=card_id)
        source_board = card.list.board
        target_list_id = request.data.get('list_id')

        if not target_list_id:
            return Response({'error': 'list_id is required'}, status=400)

        target_list = get_object_or_404(List, id=target_list_id)
        target_board = target_list.board

        # Permission checks on both boards
        if not user_can_access_board(request.user, source_board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)
        if not user_can_access_board(request.user, target_board, min_role='EDITOR'):
            return Response({'error': 'forbidden — no EDITOR access to destination board'}, status=403)

        old_list = card.list
        old_board_id = source_board.id

        # Move the card
        card.list = target_list
        card.save(update_fields=['list'])

        # Clear card members (they may not belong to the destination board)
        card.members.clear()

        channel_layer = get_channel_layer()

        # Log + broadcast on source board (card removed)
        log_activity(
            board=source_board,
            user=request.user,
            action_type='card_moved',
            description=f'moved "{card.title}" to board "{target_board.name}"',
            metadata={'to_board_id': target_board.id, 'to_list_id': target_list.id}
        )
        async_to_sync(channel_layer.group_send)(
            f'board_{old_board_id}',
            {
                'type': 'card_deleted',
                'card_id': card.id,
                'list_id': old_list.id,
                'user_id': request.user.id,
                'username': request.user.username,
            }
        )

        # Log + broadcast on destination board (card added)
        log_activity(
            board=target_board,
            user=request.user,
            action_type='card_created',
            description=f'moved "{card.title}" from board "{source_board.name}"',
            card=card,
            list_obj=target_list,
            metadata={'from_board_id': old_board_id}
        )
        async_to_sync(channel_layer.group_send)(
            f'board_{target_board.id}',
            {
                'type': 'card_created',
                'card_data': CardSerializer(card).data,
                'list_id': target_list.id,
                'user_id': request.user.id,
                'username': request.user.username,
            }
        )

        return Response(CardSerializer(card).data)
