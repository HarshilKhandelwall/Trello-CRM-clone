from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import connection
from .models import Board, BoardMember
from .serializers import BoardSerializer
from .auth import CsrfExemptSessionAuthentication
from .permissions import user_can_access_board


class BoardBackgroundView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, board_id):
        """Update board background"""
        board = get_object_or_404(Board, id=board_id)
        
        # Check if user has EDITOR permission
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'Need EDITOR permission to modify board'}, status=403)
        
        # Update background fields
        background_type = request.data.get('background_type')
        background_value = request.data.get('background_value')
        background_brightness = request.data.get('background_brightness')
        
        if background_type:
            board.background_type = background_type
        if background_value:
            board.background_value = background_value
        if background_brightness:
            board.background_brightness = background_brightness
            
        board.save()
        
        return Response(BoardSerializer(board).data)


class BoardDetailView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, board_id):
        """Get board details"""
        board = get_object_or_404(Board, id=board_id)
        
        # Check if user has access to the board (VIEWER or higher)
        if not user_can_access_board(request.user, board):
            return Response({'error': 'forbidden'}, status=403)
        
        return Response(BoardSerializer(board).data)
    
    def delete(self, request, board_id):
        """Delete a board"""
        board = get_object_or_404(Board, id=board_id)
        
        # Only ADMIN or OWNER can delete boards
        if not user_can_access_board(request.user, board, min_role='ADMIN'):
            return Response({'error': 'Need ADMIN permission to delete board'}, status=403)
        
        board_name = board.name
        
        # Delete board with FK workaround for SQLite
        with connection.cursor() as cursor:
            cursor.execute("PRAGMA foreign_keys = OFF")
            try:
                board.delete()
            finally:
                cursor.execute("PRAGMA foreign_keys = ON")
        
        return Response({'status': 'deleted', 'message': f'Board "{board_name}" deleted successfully'}, status=204)

    def patch(self, request, board_id):
        """Update board name"""
        board = get_object_or_404(Board, id=board_id)
        
        # Check if user has EDITOR permission
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'Need EDITOR permission to modify board'}, status=403)
        
        if 'name' in request.data:
            board.name = request.data['name']
            board.save()
        
        return Response(BoardSerializer(board).data)
