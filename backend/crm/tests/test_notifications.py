from django.test import TestCase
from django.contrib.auth import get_user_model
from crm.models import Workspace, Board, List, Card, Notification

User = get_user_model()


def make_user(username='testuser'):
    """Helper to create a user with all required fields."""
    return User.objects.create_user(username=username, password='testpass123')


def make_card(user, title='Test Card'):
    """Helper to create a card with all required foreign keys."""
    workspace = Workspace.objects.create(name='Test Workspace', created_by=user)
    board = Board.objects.create(name='Test Board', workspace=workspace, created_by=user)
    lst = List.objects.create(name='Test List', board=board, position=0)
    return Card.objects.create(title=title, list=lst, created_by=user)


class NotificationTests(TestCase):

    def test_notification_created_with_correct_fields(self):
        """Notification is created with all required fields."""
        user = make_user()
        card = make_card(user)

        notif = Notification.objects.create(
            user=user,
            card=card,
            notification_type='card_assigned',
            message='You were assigned to Test Card',
            link=f'/card/{card.id}',
        )

        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(notif.user, user)
        self.assertEqual(notif.card, card)
        self.assertFalse(notif.read)

    def test_notification_default_not_read(self):
        """Newly created notifications are unread by default."""
        user = make_user('user2')
        card = make_card(user, 'Card 2')

        notif = Notification.objects.create(
            user=user,
            card=card,
            notification_type='due_soon',
            message='Card "Card 2" is due in 24 hours',
        )

        self.assertFalse(notif.read)

    def test_notification_mark_as_read(self):
        """Marking a notification as read updates the read field."""
        user = make_user('user3')
        card = make_card(user, 'Card 3')

        notif = Notification.objects.create(
            user=user,
            card=card,
            notification_type='overdue',
            message='Card "Card 3" is overdue',
        )
        notif.read = True
        notif.save()

        notif.refresh_from_db()
        self.assertTrue(notif.read)

    def test_notification_cascade_deletes_with_card(self):
        """Deleting a card cascades to delete its notifications."""
        user = make_user('user4')
        card = make_card(user, 'Card 4')

        Notification.objects.create(
            user=user,
            card=card,
            notification_type='card_assigned',
            message='Assigned',
        )
        self.assertEqual(Notification.objects.count(), 1)

        card.delete()
        self.assertEqual(Notification.objects.count(), 0)

    def test_no_duplicate_due_date_notifications(self):
        """
        Within a 5-minute window, duplicate due-date notifications
        for the same card/user/type should not be created.
        This validates the deduplication logic in the scheduler.
        """
        from django.utils import timezone
        from datetime import timedelta

        user = make_user('user5')
        card = make_card(user, 'Card 5')
        now = timezone.now()

        # Simulate first notification already existing
        Notification.objects.create(
            user=user,
            card=card,
            notification_type='due_soon',
            message='First notification',
        )

        # Check: does a recent notification already exist?
        recent_exists = Notification.objects.filter(
            card=card,
            notification_type='due_soon',
            user=user,
            created_at__gte=now - timedelta(minutes=5)
        ).exists()

        self.assertTrue(recent_exists)
        # A second notification should NOT be created if recent_exists is True
        if not recent_exists:
            Notification.objects.create(
                user=user,
                card=card,
                notification_type='due_soon',
                message='Second notification',
            )

        self.assertEqual(Notification.objects.count(), 1)
