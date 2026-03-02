from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from crm.views_workspaces import WorkspaceListView, WorkspaceDetailView, BoardCreateView, AccessibleBoardsView
from crm.views_workspace_members import WorkspaceMembersListView, WorkspaceMemberDetailView
from crm.views_boards import BoardBackgroundView, BoardDetailView
from crm.views_lists import ListCreateView, ListDetailView, MoveListView
from crm.views_cards import CreateCardView, MoveCardView, CardDetailView, CopyCardView, MoveCardToBoardView
from crm.views_archive import ArchiveCardView, RestoreCardView, ArchivedCardsView
from crm.views_attachments import AttachmentUploadView, AttachmentDetailView
from crm.views_checklists import ChecklistViewSet, ChecklistItemViewSet
from crm.views_comments import CommentViewSet
from crm.views_members import AddCardMemberView, RemoveCardMemberView
from crm.views_board_members import BoardMembersView, BoardMemberDetailView, UserSearchView
from crm.views_activities import BoardActivitiesView
from crm.views_tasks import TodayTasksView
from crm.views_labels import LabelListCreateView, LabelUpdateDeleteView
from crm.views_search import CardSearchView, CardAutocompleteView
from crm.views_notifications import (
    NotificationListView, 
    MarkNotificationReadView, 
    MarkAllNotificationsReadView,
    UnreadNotificationCountView
)
from crm.views_auth import (
    RegisterView,
    LoginView,
    LogoutView,
    CurrentUserView,
    GetCSRFTokenView
)

urlpatterns = [
    # Authentication
    path('api/auth/register/', RegisterView.as_view()),
    path('api/auth/login/', LoginView.as_view()),
    path('api/auth/logout/', LogoutView.as_view()),
    path('api/auth/user/', CurrentUserView.as_view()),
    path('api/auth/csrf/', GetCSRFTokenView.as_view()),

    # Workspaces
    path('api/workspaces/', WorkspaceListView.as_view()),
    path('api/workspaces/accessible-boards/', AccessibleBoardsView.as_view()),
    path('api/workspaces/<int:workspace_id>/', WorkspaceDetailView.as_view()),
    
    # Workspace Members
    path('api/workspaces/<int:workspace_id>/members/', WorkspaceMembersListView.as_view()),
    path('api/workspaces/<int:workspace_id>/members/<int:user_id>/', WorkspaceMemberDetailView.as_view()),

    # Boards
    path('api/workspaces/<int:workspace_id>/boards/', BoardCreateView.as_view()),
    path('api/boards/<int:board_id>/', BoardDetailView.as_view()),
    path('api/boards/<int:board_id>/background/', BoardBackgroundView.as_view()),
    path('api/boards/<int:board_id>/activities/', BoardActivitiesView.as_view()),
    path('api/boards/<int:board_id>/today-tasks/', TodayTasksView.as_view()),
    path('api/boards/<int:board_id>/members/', BoardMembersView.as_view()),
    path('api/boards/<int:board_id>/members/<int:user_id>/', BoardMemberDetailView.as_view()),
    path('api/boards/<int:board_id>/search/', CardSearchView.as_view()),
    path('api/boards/<int:board_id>/cards/autocomplete/', CardAutocompleteView.as_view()),
    
    # Labels
    path('api/boards/<int:board_id>/labels/', LabelListCreateView.as_view()),
    path('api/labels/<int:label_id>/', LabelUpdateDeleteView.as_view()),

    # Lists
    path('api/boards/<int:board_id>/lists/', ListCreateView.as_view()),
    path('api/lists/<int:list_id>/', ListDetailView.as_view()),
    path('api/lists/move/', MoveListView.as_view()),

    # Cards
    path('api/cards/', CreateCardView.as_view()),
    path('api/cards/<int:card_id>/', CardDetailView.as_view()),
    path('api/cards/move/', MoveCardView.as_view()),
    path('api/cards/<int:card_id>/copy/', CopyCardView.as_view()),
    path('api/cards/<int:card_id>/move-to-board/', MoveCardToBoardView.as_view()),
    path('api/cards/<int:card_id>/archive/', ArchiveCardView.as_view()),
    path('api/cards/<int:card_id>/restore/', RestoreCardView.as_view()),
    path('api/boards/<int:board_id>/archived-cards/', ArchivedCardsView.as_view()),

    # Attachments
    path('api/cards/<int:card_id>/attachments/', AttachmentUploadView.as_view()),
    path('api/attachments/<int:attachment_id>/', AttachmentDetailView.as_view()),

    # Checklists
    path('api/checklists/', ChecklistViewSet.as_view({'post': 'create'})),
    path('api/checklists/<int:pk>/', ChecklistViewSet.as_view({'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})),
    
    # Checklist Items
    path('api/checklist-items/', ChecklistItemViewSet.as_view({'post': 'create'})),
    path('api/checklist-items/<int:pk>/', ChecklistItemViewSet.as_view({'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})),

    # Comments
    path('api/comments/', CommentViewSet.as_view({'get': 'list', 'post': 'create'})),
    path('api/comments/<int:pk>/', CommentViewSet.as_view({'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})),

    # Members
    path('api/cards/<int:card_id>/members/add/', AddCardMemberView.as_view()),
    path('api/cards/<int:card_id>/members/remove/', RemoveCardMemberView.as_view()),

    # Notifications
    path('api/notifications/', NotificationListView.as_view()),
    path('api/notifications/<int:notification_id>/read/', MarkNotificationReadView.as_view()),
    path('api/notifications/mark-all-read/', MarkAllNotificationsReadView.as_view()),
    path('api/notifications/unread-count/', UnreadNotificationCountView.as_view()),
    
    # User search
    path('api/users/search/', UserSearchView.as_view()),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
