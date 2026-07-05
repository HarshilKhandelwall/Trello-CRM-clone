from rest_framework import serializers
from crm.models import Workspace, Board, List, Card, Comment, Notification, Attachment, Checklist, ChecklistItem, Activity, Label, WorkspaceMember, BoardMember
from crm.serializers_labels import LabelSerializer
from django.contrib.auth import get_user_model

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user authentication and profile data"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = ['id']


class WorkspaceMemberSerializer(serializers.ModelSerializer):
    """Serializer for workspace membership"""
    user = UserSerializer(read_only=True)
    added_by_name = serializers.CharField(source='added_by.username', read_only=True)
    workspace_name = serializers.CharField(source='workspace.name', read_only=True)
    
    class Meta:
        model = WorkspaceMember
        fields = ['id', 'workspace', 'workspace_name', 'user', 'role', 'added_by', 'added_by_name', 'added_at']
        read_only_fields = ['id', 'added_at']


class ChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItem
        fields = ['id', 'text', 'completed', 'position', 'created_at']


class ChecklistSerializer(serializers.ModelSerializer):
    items = ChecklistItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Checklist
        fields = ['id', 'name', 'position', 'items', 'created_at']


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.username', read_only=True)
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Attachment
        fields = ['id', 'card', 'file', 'file_url', 'filename', 'uploaded_by', 'uploaded_by_name', 'uploaded_at']
        read_only_fields = ['uploaded_by', 'uploaded_at']
    
    def get_file_url(self, obj):
        if obj.file:
            return f'/api/attachments/{obj.id}/download/'
        return None

class CardSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)
    checklists = ChecklistSerializer(many=True, read_only=True)
    comments_count = serializers.SerializerMethodField()
    member_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        source='members',
        write_only=True,
        required=False
    )
    members = serializers.SerializerMethodField()
    labels = LabelSerializer(many=True, read_only=True)
    label_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Label.objects.all(),
        source='labels',
        write_only=True,
        required=False
    )
    list_name = serializers.CharField(source='list.name', read_only=True)
    
    class Meta:
        model = Card
        fields = ['id', 'title', 'description', 'email', 'phone', 'due_at', 'labels', 'label_ids',
                  'list', 'list_name', 'position', 'created_by', 'created_at', 'attachments', 'checklists', 
                  'comments_count', 'members', 'member_ids', 'archived', 'archived_at', 'archived_by']
    
    def get_comments_count(self, obj):
        return obj.comments.count()
    
    def get_members(self, obj):
        return [{'id': m.id, 'username': m.username, 'email': m.email} for m in obj.members.all()]


class ListSerializer(serializers.ModelSerializer):
    cards = serializers.SerializerMethodField()

    class Meta:
        model = List
        fields = ['id', 'name', 'position', 'cards']
    
    def get_cards(self, obj):
        # Filter out archived cards and order by position
        cards = obj.cards.filter(archived=False).order_by('position', 'id')
        
        # ── M-1 FIX: Use prefetch_related to avoid N+1 queries when serializing nested fields
        cards = cards.prefetch_related('checklists__items', 'attachments', 'members', 'labels')
        
        return CardSerializer(cards, many=True).data

class BoardMemberBriefSerializer(serializers.ModelSerializer):
    """Minimal board member data for the board header role badge."""
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = BoardMember
        fields = ['id', 'user_id', 'username', 'role']


class BoardSerializer(serializers.ModelSerializer):
    lists = ListSerializer(many=True, read_only=True)
    members = serializers.SerializerMethodField()

    class Meta:
        model = Board
        fields = ['id', 'name', 'lists', 'members', 'background_type', 'background_value', 'background_brightness']

    def get_members(self, obj):
        from crm.permissions import get_effective_board_members
        effective = get_effective_board_members(obj)
        data = []
        for em in effective:
            user = em['user']
            data.append({
                'id': em['id'],
                'user_id': user.id,
                'username': user.username,
                'role': em['role'],
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name
                }
            })
        return data


class WorkspaceSerializer(serializers.ModelSerializer):
    boards = BoardSerializer(many=True, read_only=True)

    class Meta:
        model = Workspace
        fields = ['id', 'name', 'boards']

class CommentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = Comment
        fields = ['id', 'card', 'user', 'user_name', 'user_email', 'text', 'created_at', 'updated_at']
        read_only_fields = ['user', 'created_at', 'updated_at']


class NotificationSerializer(serializers.ModelSerializer):
    card_title = serializers.CharField(source='card.title', read_only=True)
    
    class Meta:
        model = Notification
        fields = ['id', 'notification_type', 'message', 'link', 'read', 'created_at', 'card', 'card_title']
        read_only_fields = ['created_at']


class ActivitySerializer(serializers.ModelSerializer):
    """Serializer for board activity feed"""
    user = UserSerializer(read_only=True)
    user_name = serializers.SerializerMethodField()
    card_title = serializers.CharField(source='card.title', read_only=True)
    list_name = serializers.CharField(source='list.name', read_only=True)
    
    def get_user_name(self, obj):
        """Get user's display name or 'System' for automated activities"""
        if obj.user:
            if obj.user.first_name and obj.user.last_name:
                return f"{obj.user.first_name} {obj.user.last_name}"
            return obj.user.username
        return 'System'
    
    class Meta:
        model = Activity
        fields = [
            'id', 'board', 'user', 'user_name', 'action_type', 'card', 'card_title',
            'list', 'list_name', 'description', 'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
