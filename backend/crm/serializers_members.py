from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import BoardMember

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user details"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class BoardMemberSerializer(serializers.ModelSerializer):
    """Serializer for board members with user details"""
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True, required=False)
    added_by_username = serializers.CharField(source='added_by.username', read_only=True)
    
    class Meta:
        model = BoardMember
        fields = ['id', 'user', 'user_id', 'role', 'added_at', 'added_by_username']
        read_only_fields = ['id', 'added_at']
    
    def create(self, validated_data):
        """Create a new board member"""
        user_id = validated_data.pop('user_id', None)
        if user_id:
            validated_data['user_id'] = user_id
        return super().create(validated_data)


class UserSearchSerializer(serializers.ModelSerializer):
    """Serializer for user search results"""
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name']
    
    def get_full_name(self, obj):
        """Get user's full name or username"""
        full_name = f"{obj.first_name} {obj.last_name}".strip()
        return full_name if full_name else obj.username
