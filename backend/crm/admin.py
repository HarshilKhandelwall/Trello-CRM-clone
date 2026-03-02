from django.contrib import admin
from .models import Workspace, Board, BoardMember, List, Card, Comment, Label, Attachment, Activity, Reminder, Notification

admin.site.register(Workspace)
admin.site.register(Board)
admin.site.register(BoardMember)
admin.site.register(List)
admin.site.register(Card)
admin.site.register(Comment)
admin.site.register(Label)
admin.site.register(Attachment)
admin.site.register(Activity)
admin.site.register(Reminder)
admin.site.register(Notification)
