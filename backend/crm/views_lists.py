from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import transaction
from crm.models import Board, List, BoardMember
from crm.serializers import ListSerializer
from crm.auth import CsrfExemptSessionAuthentication
from crm.utils import broadcast_to_board, log_activity
from crm.permissions import user_can_access_board



class ListCreateView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, board_id):
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        board = get_object_or_404(Board, id=board_id)
        
        # Check permissions
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)
        
        name = request.data.get('name', 'Untitled List')
        position = request.data.get('position', board.lists.count())
        
        lst = List.objects.create(
            board=board,
            name=name,
            position=position
        )
        
        # Log activity
        log_activity(
            board=board,
            user=request.user,
            action_type='list_created',
            description=f'added list "{lst.name}"',
            list_obj=lst
        )
        
        # Broadcast WebSocket event
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board.id}',
            {
                'type': 'list_created',
                'list_data': ListSerializer(lst).data,
                'user_id': request.user.id,
                'username': request.user.username
            }
        )
        
        return Response(ListSerializer(lst).data, status=201)


class ListDetailView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, list_id):
        lst = get_object_or_404(List, id=list_id)
        board = lst.board
        
        if not user_can_access_board(request.user, board, min_role='VIEWER'):
            return Response({'error': 'forbidden'}, status=403)
        
        return Response(ListSerializer(lst).data)

    def patch(self, request, list_id):
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        lst = get_object_or_404(List, id=list_id)
        board = lst.board
        
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)
        
        serializer = ListSerializer(lst, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        # Log activity
        log_activity(
            board=board,
            user=request.user,
            action_type='list_updated',
            description=f'renamed list to "{lst.name}"',
            list_obj=lst
        )
        
        # Broadcast WebSocket event
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board.id}',
            {
                'type': 'list_updated',
                'list_data': serializer.data,
                'user_id': request.user.id,
                'username': request.user.username
            }
        )
        
        return Response(serializer.data)

    def delete(self, request, list_id):
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        lst = get_object_or_404(List, id=list_id)
        board = lst.board
        list_id_to_delete = lst.id
        
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)
        
        list_name = lst.name

        # ── C-7 FIX: Django ORM already handles CASCADE deletes in Python.
        # The PRAGMA foreign_keys = OFF workaround was unnecessary and unsafe.
        with transaction.atomic():
            lst.delete()
        
        # Log activity AFTER deletion (don't reference the deleted list)
        log_activity(
            board=board,
            user=request.user,
            action_type='list_deleted',
            description=f'deleted list "{list_name}"',
            metadata={'list_id': list_id_to_delete, 'list_name': list_name}
        )
        
        # Broadcast WebSocket event
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board.id}',
            {
                'type': 'list_deleted',
                'list_id': list_id_to_delete,
                'user_id': request.user.id,
                'username': request.user.username
            }
        )
        
        return Response({'status': 'deleted'}, status=204)


class MoveListView(APIView):
    """
    Move a list to a new position on the board.
    POST /api/lists/move/
    Body: { "list_id": 123, "board_id": 45, "position": 2 }
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        list_id = request.data.get('list_id')
        board_id = request.data.get('board_id')
        new_position = request.data.get('position', 0)
        
        # Get list and board
        lst = get_object_or_404(List, id=list_id)
        board = get_object_or_404(Board, id=board_id)
        
        # Check permissions
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)
        
        # Ensure list belongs to this board
        if lst.board.id != board.id:
            return Response({'error': 'List does not belong to this board'}, status=400)
        
        old_position = lst.position
        
        # Update positions
        if new_position != old_position:
            # Get all lists on the board
            lists = List.objects.filter(board=board).order_by('position')
            
            # Remove list from old position
            lists_array = list(lists)
            lists_array = [l for l in lists_array if l.id != lst.id]
            
            # Insert at new position
            lists_array.insert(new_position, lst)
            
            # ── M-6 FIX: Use transaction.atomic() to ensure list position updates are atomic
            with transaction.atomic():
                for index, list_item in enumerate(lists_array):
                    if list_item.position != index:
                        list_item.position = index
                        list_item.save(update_fields=['position'])
            
            # Log activity
            log_activity(
                board=board,
                user=request.user,
                action_type='list_updated',
                description=f'moved list "{lst.name}"',
                list_obj=lst,
                metadata={'old_position': old_position, 'new_position': new_position}
            )
            
            # Broadcast WebSocket event
            broadcast_to_board(board.id, 'list_moved', {
                'list_id': lst.id,
                'board_id': board.id,
                'old_position': old_position,
                'new_position': new_position,
                'user_id': request.user.id,
                'username': request.user.username
            })
        
        return Response({
            'status': 'moved',
            'list': ListSerializer(lst).data
        })

