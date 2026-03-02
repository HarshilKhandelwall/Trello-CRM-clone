"""
Views for daily to-do list functionality.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
from crm.models import Card, Board, BoardMember
from crm.serializers import CardSerializer
from crm.auth import CsrfExemptSessionAuthentication
from crm.permissions import user_can_access_board


class TodayTasksView(APIView):
    """Get all cards due today and overdue cards for a board"""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, board_id):
        board = get_object_or_404(Board, id=board_id)
        
        # Check permissions
        if not user_can_access_board(request.user, board, min_role='VIEWER'):
            return Response({'error': 'forbidden'}, status=403)
        
        # Get today's date range (start of day to end of day)
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        # Get cards due today (not archived)
        today_cards = Card.objects.filter(
            list__board=board,
            archived=False,
            due_at__isnull=False,
            due_at__gte=today_start,
            due_at__lt=today_end
        ).select_related('list', 'created_by').order_by('due_at')
        
        # Get overdue cards (before today, not archived)
        overdue_cards = Card.objects.filter(
            list__board=board,
            archived=False,
            due_at__isnull=False,
            due_at__lt=today_start
        ).select_related('list', 'created_by').order_by('due_at')
        
        # Serialize the data
        today_serializer = CardSerializer(today_cards, many=True)
        overdue_serializer = CardSerializer(overdue_cards, many=True)
        
        return Response({
            'today': today_serializer.data,
            'overdue': overdue_serializer.data,
            'count': {
                'today': today_cards.count(),
                'overdue': overdue_cards.count(),
                'total': today_cards.count() + overdue_cards.count()
            }
        })
