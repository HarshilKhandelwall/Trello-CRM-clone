"""
Views for board activity feed.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from crm.models import Board, Activity, BoardMember
from crm.serializers import ActivitySerializer
from crm.permissions import user_can_access_board


class BoardActivitiesView(APIView):
    """
    API endpoint to retrieve board activities.
    GET /api/boards/{board_id}/activities/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, board_id):
        """Get paginated list of activities for a board"""
        board = get_object_or_404(Board, id=board_id)
        
        # Check if user has access to this board (allow superusers)
        if not user_can_access_board(request.user, board, min_role='VIEWER'):
            return Response({'error': 'You do not have access to this board'}, status=403)
        
        # Get activities
        activities = Activity.objects.filter(board=board).select_related('user', 'card', 'list')
        
        # Optional filtering by action type
        action_type = request.query_params.get('action_type')
        if action_type:
            activities = activities.filter(action_type=action_type)
        
        # Optional filtering by card_id
        card_id = request.query_params.get('card_id')
        if card_id:
            activities = activities.filter(card_id=card_id)
        
        # Pagination
        page_size = int(request.query_params.get('page_size', 50))
        page = int(request.query_params.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size
        
        # Get page of activities
        activities_page = activities[start:end]
        total_count = activities.count()
        
        # Serialize
        serializer = ActivitySerializer(activities_page, many=True)
        
        return Response({
            'results': serializer.data,
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'has_more': end < total_count
        })
