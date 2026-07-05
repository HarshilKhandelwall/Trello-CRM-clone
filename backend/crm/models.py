from django.db import models
from django.conf import settings

User = settings.AUTH_USER_MODEL

class Workspace(models.Model):
    name = models.CharField(max_length=255)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)


    def __str__(self):
        return self.name


class WorkspaceMember(models.Model):
    """
    Workspace-level membership with role-based permissions.
    Members of a workspace automatically get access to all boards within it.
    """
    ROLE_CHOICES = (
        ('OWNER', 'Owner'),       # Workspace creator, full control
        ('ADMIN', 'Admin'),       # Can manage workspace members
        ('EDITOR', 'Editor'),     # Can edit all boards
        ('VIEWER', 'Viewer'),     # Read-only access
    )

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='workspace_members')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workspace_memberships')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    added_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='workspace_members_added')
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('workspace', 'user')
        ordering = ['-added_at']

    def __str__(self):
        return f"{self.user.username} - {self.workspace.name} ({self.role})"



class Board(models.Model):
    BACKGROUND_TYPE_CHOICES = [
        ('color', 'Solid Color'),
        ('gradient', 'Gradient'),
        ('photo', 'Photo'),
    ]
    
    BRIGHTNESS_CHOICES = [
        ('light', 'Light'),
        ('dark', 'Dark'),
    ]
    
    name = models.CharField(max_length=255)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='boards')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Background customization
    background_type = models.CharField(max_length=20, choices=BACKGROUND_TYPE_CHOICES, default='color')
    background_value = models.TextField(default='#0079BF')  # Default Trello blue
    background_brightness = models.CharField(max_length=10, choices=BRIGHTNESS_CHOICES, default='dark')

    def __str__(self):
        return self.name


class BoardMember(models.Model):
    ROLE_CHOICES = (
        ('ADMIN', 'Admin'),
        ('EDITOR', 'Editor'),
        ('VIEWER', 'Viewer'),
    )

    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    added_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='members_added')
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('board', 'user')


class List(models.Model):
    name = models.CharField(max_length=255)
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='lists')
    position = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.name


class Card(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    labels = models.ManyToManyField('Label', related_name='cards', blank=True)
    members = models.ManyToManyField(User, related_name='assigned_cards', blank=True)

    list = models.ForeignKey(List, on_delete=models.CASCADE, related_name='cards')
    position = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Archiving fields
    archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='archived_cards')

    def __str__(self):
        return self.title


class Checklist(models.Model):
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name='checklists')
    name = models.CharField(max_length=255, default="Checklist")
    position = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['position']
    
    def __str__(self):
        return f"{self.name} ({self.card.title})"


class ChecklistItem(models.Model):
    checklist = models.ForeignKey(Checklist, on_delete=models.CASCADE, related_name='items')
    text = models.TextField()
    completed = models.BooleanField(default=False)
    position = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['position']
    
    def __str__(self):
        return self.text[:50]


class Comment(models.Model):
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']  # Newest first
    
    def __str__(self):
        return f"{self.user.username}: {self.text[:30]}"


class Label(models.Model):
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['name']
        unique_together = ('name', 'color')  # Global uniqueness by name+color
    
    def __str__(self):
        return f"{self.name} ({self.color})"


class Attachment(models.Model):
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='attachments/')
    filename = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.file and not self.filename:
            self.filename = self.file.name
        super().save(*args, **kwargs)


class Reminder(models.Model):
    card = models.ForeignKey(Card, on_delete=models.CASCADE)
    remind_at = models.DateTimeField()
    sent = models.BooleanField(default=False)


class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('due_soon', 'Due Soon'),
        ('due_now', 'Due Now'),
        ('overdue', 'Overdue'),
        ('card_assigned', 'Card Assigned'),
        ('card_moved', 'Card Moved'),
        ('comment_added', 'Comment Added'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    card = models.ForeignKey(Card, on_delete=models.CASCADE, null=True, blank=True)
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='due_soon')
    message = models.CharField(max_length=255)
    link = models.CharField(max_length=255, blank=True)  # Link to card/board
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.message}"


class Activity(models.Model):
    """
    Track all board activities for the activity feed.
    Records who did what, when, and on which board/card/list.
    """
    ACTION_TYPES = [
        ('card_created', 'Card Created'),
        ('card_updated', 'Card Updated'),
        ('card_moved', 'Card Moved'),
        ('card_deleted', 'Card Deleted'),
        ('card_archived', 'Card Archived'),
        ('card_restored', 'Card Restored'),
        ('list_created', 'List Created'),
        ('list_updated', 'List Updated'),
        ('list_deleted', 'List Deleted'),
        ('comment_added', 'Comment Added'),
        ('comment_updated', 'Comment Updated'),
        ('comment_deleted', 'Comment Deleted'),
        ('member_added', 'Member Added'),
        ('member_removed', 'Member Removed'),
        ('label_added', 'Label Added'),
        ('label_removed', 'Label Removed'),
        ('due_date_set', 'Due Date Set'),
        ('due_date_changed', 'Due Date Changed'),
        ('attachment_added', 'Attachment Added'),
        ('checklist_item_completed', 'Checklist Item Completed'),
    ]
    
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='activities')
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    action_type = models.CharField(max_length=50, choices=ACTION_TYPES, default='card_updated')
    
    # Optional references to related objects
    card = models.ForeignKey(Card, on_delete=models.SET_NULL, null=True, blank=True)
    list = models.ForeignKey('List', on_delete=models.SET_NULL, null=True, blank=True)
    
    # Activity details
    description = models.TextField()  # Human-readable description
    metadata = models.JSONField(default=dict, blank=True)  # Additional data (old values, new values, etc.)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['board', '-created_at']),
            models.Index(fields=['action_type', '-created_at']),
        ]
        verbose_name_plural = 'Activities'
    
    def __str__(self):
        username = self.user.username if self.user else 'System'
        return f"{username} - {self.action_type} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"
