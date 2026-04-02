from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from crm.models import Card, Notification
from crm.utils import send_notification_to_user


class Command(BaseCommand):
    help = 'Check for due cards and create notifications and push via WebSocket'

    def _push(self, notification):
        """Send a newly created notification to the user via WebSocket."""
        send_notification_to_user(notification.user_id, {
            'id': notification.id,
            'type': notification.notification_type,
            'message': notification.message,
            'card_id': notification.card_id,
            'card_title': notification.card.title if notification.card else None,
            'created_at': notification.created_at.isoformat(),
            'read': False,
        })

    def handle(self, *args, **kwargs):
        now = timezone.now()

        # Get all non-archived cards with due dates
        cards_with_due_dates = Card.objects.filter(due_at__isnull=False, archived=False)

        for card in cards_with_due_dates:
            # ── Overdue ───────────────────────────────────────────────────────
            if card.due_at < now:
                existing = Notification.objects.filter(
                    card=card,
                    notification_type='overdue',
                    user=card.created_by
                ).exists()

                if not existing:
                    notif = Notification.objects.create(
                        user=card.created_by,
                        card=card,
                        notification_type='overdue',
                        message=f'Card "{card.title}" is overdue',
                        link=f'/card/{card.id}'
                    )
                    self._push(notif)
                    self.stdout.write(self.style.WARNING(
                        f'Overdue notification sent for card: {card.title}'))
                continue

            time_until_due = card.due_at - now

            # ── Due in next hour ──────────────────────────────────────────────
            if timedelta(minutes=0) <= time_until_due <= timedelta(hours=1):
                existing = Notification.objects.filter(
                    card=card,
                    notification_type='due_now',
                    user=card.created_by,
                    created_at__gte=now - timedelta(hours=1)
                ).exists()

                if not existing:
                    notif = Notification.objects.create(
                        user=card.created_by,
                        card=card,
                        notification_type='due_now',
                        message=f'Card "{card.title}" is due in less than 1 hour',
                        link=f'/card/{card.id}'
                    )
                    self._push(notif)
                    self.stdout.write(self.style.SUCCESS(
                        f'due_now notification sent for card: {card.title}'))

            # ── Due in next 24 hours ──────────────────────────────────────────
            elif timedelta(hours=1) < time_until_due <= timedelta(hours=24):
                existing = Notification.objects.filter(
                    card=card,
                    notification_type='due_soon',
                    user=card.created_by,
                    created_at__gte=now - timedelta(hours=24)
                ).exists()

                if not existing:
                    hours_until_due = int(time_until_due.total_seconds() / 3600)
                    notif = Notification.objects.create(
                        user=card.created_by,
                        card=card,
                        notification_type='due_soon',
                        message=f'Card "{card.title}" is due in {hours_until_due} hours',
                        link=f'/card/{card.id}'
                    )
                    self._push(notif)
                    self.stdout.write(self.style.SUCCESS(
                        f'due_soon notification sent for card: {card.title}'))

        self.stdout.write(self.style.SUCCESS('Notification check complete'))
