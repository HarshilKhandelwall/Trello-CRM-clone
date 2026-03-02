from rest_framework import serializers
from crm.models import Label

class LabelSerializer(serializers.ModelSerializer):
    card_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Label
        fields = ['id', 'name', 'color', 'created_at', 'card_count']
        read_only_fields = ['created_at']
    
    def get_card_count(self, obj):
        return obj.cards.count() if hasattr(obj, 'cards') else 0
