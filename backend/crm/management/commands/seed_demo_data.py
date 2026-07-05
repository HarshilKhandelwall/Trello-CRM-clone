from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import random
from crm.models import (
    Workspace, WorkspaceMember, Board, BoardMember, List, Card,
    Checklist, ChecklistItem, Comment, Label, Activity,
    Attachment, Reminder, Notification
)

class Command(BaseCommand):
    help = 'Seeds the database with high-quality demo/presentation data'

    def handle(self, *args, **options):
        self.stdout.write('Clearing existing data (except superusers)...')
        
        # Delete existing data in dependency order
        self.stdout.write('Clearing existing data (except superusers)...')
        Activity.objects.all().delete()
        Comment.objects.all().delete()
        ChecklistItem.objects.all().delete()
        Checklist.objects.all().delete()
        Attachment.objects.all().delete()
        Reminder.objects.all().delete()
        Notification.objects.all().delete()
        Card.objects.all().delete()
        List.objects.all().delete()
        BoardMember.objects.all().delete()
        Board.objects.all().delete()
        WorkspaceMember.objects.all().delete()
        Workspace.objects.all().delete()
        Label.objects.all().delete()
        User.objects.exclude(is_superuser=True).delete()
        
        admin_user = User.objects.filter(is_superuser=True).first()
        if not admin_user:
            # Create a fallback superuser if none exists
            admin_user = User.objects.create_superuser('admin', 'admin@example.com', 'admin')
            self.stdout.write('Created default admin/admin superuser.')

        # Create demo users
        demo_users = []
        user_info = [
            ('alice', 'Alice', 'Smith', 'alice@example.com'),
            ('bob', 'Bob', 'Jones', 'bob@example.com'),
            ('charlie', 'Charlie', 'Brown', 'charlie@example.com'),
            ('david', 'David', 'Miller', 'david@example.com'),
            ('emma', 'Emma', 'Wilson', 'emma@example.com'),
        ]
        for username, first_name, last_name, email in user_info:
            user = User.objects.create_user(
                username=username,
                email=email,
                password='password123',
                first_name=first_name,
                last_name=last_name
            )
            demo_users.append(user)
            self.stdout.write(f'Created user: {username}')

        # ── Global Labels ───────────────────────────────────────────────────────
        labels_data = [
            ("High Value", "#EF4444"),    # Red
            ("Warm Lead", "#F97316"),     # Orange
            ("Cold Lead", "#3B82F6"),     # Blue
            ("Bug / Critical", "#DC2626"),# Dark Red
            ("Feature", "#10B981"),       # Green
            ("Enhancement", "#8B5CF6"),   # Purple
            ("Blocked", "#F59E0B"),       # Amber
            ("In Progress", "#06B6D4"),   # Cyan
        ]
        labels = {}
        for name, color in labels_data:
            lbl = Label.objects.create(name=name, color=color)
            labels[name] = lbl

        # ── Workspace 1: Sales & Marketing ──────────────────────────────────────
        self.stdout.write('Creating Sales & Marketing Workspace...')
        sales_ws = Workspace.objects.create(name="Sales & Marketing CRM", created_by=admin_user)
        
        # Add members to workspace
        WorkspaceMember.objects.create(workspace=sales_ws, user=admin_user, role='OWNER', added_by=admin_user)
        for user in [demo_users[0], demo_users[1], demo_users[4]]: # alice, bob, emma
            WorkspaceMember.objects.create(workspace=sales_ws, user=user, role='EDITOR', added_by=admin_user)

        # Board 1: Sales CRM Pipeline
        sales_board = Board.objects.create(
            name="Sales CRM Pipeline",
            workspace=sales_ws,
            created_by=admin_user,
            background_type="gradient",
            background_value="linear-gradient(135deg, #667eea 0%, #764ba2 100%)", # Purple/Indigo
            background_brightness="dark"
        )
        
        # Create Lists for Sales
        sales_list_names = ["Leads / Incoming", "First Contact", "Demo Scheduled", "Negotiation", "Closed Won", "Closed Lost"]
        sales_lists = []
        for i, name in enumerate(sales_list_names):
            lst = List.objects.create(name=name, board=sales_board, position=i)
            sales_lists.append(lst)

        # Board 2: Q3 Marketing Campaign
        mkt_board = Board.objects.create(
            name="Q3 Marketing Campaign",
            workspace=sales_ws,
            created_by=admin_user,
            background_type="color",
            background_value="#0079BF", # Classic blue
            background_brightness="dark"
        )
        mkt_list_names = ["Campaign Ideas", "In Progress", "Review", "Live / Launched"]
        mkt_lists = []
        for i, name in enumerate(mkt_list_names):
            lst = List.objects.create(name=name, board=mkt_board, position=i)
            mkt_lists.append(lst)

        # ── Workspace 2: Engineering & Product ──────────────────────────────────
        self.stdout.write('Creating Engineering & Product Workspace...')
        eng_ws = Workspace.objects.create(name="Engineering & Product", created_by=admin_user)
        WorkspaceMember.objects.create(workspace=eng_ws, user=admin_user, role='OWNER', added_by=admin_user)
        for user in demo_users: # Everyone is in engineering
            WorkspaceMember.objects.create(workspace=eng_ws, user=user, role='EDITOR', added_by=admin_user)

        # Board 3: Product Roadmap
        roadmap_board = Board.objects.create(
            name="Product Roadmap",
            workspace=eng_ws,
            created_by=admin_user,
            background_type="gradient",
            background_value="linear-gradient(to right, #243b55, #141e30)", # Dark Slate
            background_brightness="dark"
        )
        roadmap_list_names = ["Backlog", "Q3 Planned", "In Development", "QA Testing", "Shipped"]
        roadmap_lists = []
        for i, name in enumerate(roadmap_list_names):
            lst = List.objects.create(name=name, board=roadmap_board, position=i)
            roadmap_lists.append(lst)

        # ── Add Cards to Sales CRM Pipeline ─────────────────────────────────────
        # Leads / Incoming
        lead_cards = [
            ("Acme Corp (500 seats)", "Enterprise prospect looking for custom integrations.\nContact: John Doe\nWebsite: acme.com", "john.doe@acme.com", "+1-555-0199", "High Value", demo_users[0]),
            ("Initech Solutions", "Medium business, interested in CRM sync capabilities.", "peter@initech.com", "+1-555-0142", "Warm Lead", demo_users[1]),
            ("Umbrella Corp", "Spoke briefly at the conference. Very interested in security features.", "wesker@umbrella.com", "", "Cold Lead", None),
        ]
        now = timezone.now()
        for idx, (title, desc, email, phone, label_name, assignee) in enumerate(lead_cards):
            card = Card.objects.create(
                title=title,
                description=desc,
                email=email,
                phone=phone,
                list=sales_lists[0],
                created_by=admin_user,
                due_at=now + timedelta(days=idx+2)
            )
            card.labels.add(labels[label_name])
            if assignee:
                card.members.add(assignee)
            
            # Add a checklist
            chk = Checklist.objects.create(card=card, name="Initial Triage", position=0)
            ChecklistItem.objects.create(checklist=chk, text="Research company background", completed=True, position=0)
            ChecklistItem.objects.create(checklist=chk, text="Identify decision makers", completed=False, position=1)
            ChecklistItem.objects.create(checklist=chk, text="Draft outreach email", completed=False, position=2)

        # First Contact
        contact_cards = [
            ("Hooli Inc", "Follow-up email sent. Waiting for response.", "gavin@hooli.xyz", "", "Warm Lead", demo_users[0]),
            ("Soylent Green Co", "Phone call completed. Requested a product brief.", "hr@soylent.com", "+1-555-9081", "High Value", demo_users[4]),
        ]
        for idx, (title, desc, email, phone, label_name, assignee) in enumerate(contact_cards):
            card = Card.objects.create(
                title=title,
                description=desc,
                email=email,
                phone=phone,
                list=sales_lists[1],
                created_by=admin_user,
                due_at=now + timedelta(days=1)
            )
            card.labels.add(labels[label_name])
            if assignee:
                card.members.add(assignee)
            
            # Comments
            Comment.objects.create(card=card, user=admin_user, text="Set up initial intro email.")
            Comment.objects.create(card=card, user=demo_users[0], text="Emailed Gavin, he is out of office until Monday.")

        # Demo Scheduled
        demo_cards = [
            ("Stark Industries", "Demo scheduled for next Tuesday. They want to see real-time workspace sync.", "tony@stark.com", "+1-555-3000", "High Value", demo_users[1]),
            ("Wayne Enterprises", "Demo scheduled for Friday. Interested in custom layouts and background support.", "bruce@wayne.corp", "", "Warm Lead", demo_users[4]),
        ]
        for idx, (title, desc, email, phone, label_name, assignee) in enumerate(demo_cards):
            card = Card.objects.create(
                title=title,
                description=desc,
                email=email,
                phone=phone,
                list=sales_lists[2],
                created_by=admin_user,
                due_at=now + timedelta(days=2)
            )
            card.labels.add(labels[label_name])
            if assignee:
                card.members.add(assignee)
            
            chk = Checklist.objects.create(card=card, name="Demo Prep Checklist", position=0)
            ChecklistItem.objects.create(checklist=chk, text="Create customized workspace board", completed=True, position=0)
            ChecklistItem.objects.create(checklist=chk, text="Invite team members to demo board", completed=True, position=1)
            ChecklistItem.objects.create(checklist=chk, text="Pre-record backup walkthrough video", completed=False, position=2)

            Comment.objects.create(card=card, user=demo_users[1], text="They emphasized that WebSocket updates must be extremely responsive.")

        # Negotiation
        neg_cards = [
            ("Tyrell Corp", "Contract draft sent. Discussing SLA terms.", "replicant@tyrell.com", "+1-555-2019", "High Value", demo_users[0]),
        ]
        for idx, (title, desc, email, phone, label_name, assignee) in enumerate(neg_cards):
            card = Card.objects.create(
                title=title,
                description=desc,
                email=email,
                phone=phone,
                list=sales_lists[3],
                created_by=admin_user,
                due_at=now - timedelta(days=1) # Overdue!
            )
            card.labels.add(labels[label_name])
            card.labels.add(labels["Blocked"])
            if assignee:
                card.members.add(assignee)
            
            Comment.objects.create(card=card, user=demo_users[0], text="Legal team is reviewing Section 4 on data retention.")

        # Closed Won
        won_cards = [
            ("Globex Corporation", "100 seats, annual contract signed!", "scorpio@globex.com", "", "High Value", demo_users[1]),
            ("Cyberdyne Systems", "Initial pilot project complete. Upgraded to full team subscription.", "sarah@cyberdyne.io", "", "Warm Lead", demo_users[4]),
        ]
        for idx, (title, desc, email, phone, label_name, assignee) in enumerate(won_cards):
            card = Card.objects.create(
                title=title,
                description=desc,
                email=email,
                phone=phone,
                list=sales_lists[4],
                created_by=admin_user,
                due_at=now - timedelta(days=5)
            )
            card.labels.add(labels[label_name])
            if assignee:
                card.members.add(assignee)
            
            Comment.objects.create(card=card, user=demo_users[1], text="Contract fully executed. Handed over to Customer Success.")

        # ── Add Cards to Product Roadmap ────────────────────────────────────────
        # Backlog
        backlog_cards = [
            ("Dark Mode support", "Allow users to toggle a global dark theme for the CRM.", "", "", "Enhancement", None),
            ("Export to CSV / Excel", "Download card data and contact details in tabular formats.", "", "", "Feature", None),
            ("Notification emails", "Send weekly summary emails of overdue and upcoming tasks to users.", "", "", "Enhancement", None),
        ]
        for idx, (title, desc, email, phone, label_name, assignee) in enumerate(backlog_cards):
            card = Card.objects.create(
                title=title,
                description=desc,
                list=roadmap_lists[0],
                created_by=admin_user,
            )
            card.labels.add(labels[label_name])

        # Q3 Planned
        planned_cards = [
            ("Attachment uploads directly to S3", "Move from local uploads to secure AWS S3 buckets.", "", "", "Feature", demo_users[2]), # charlie
            ("Checklist progress bars", "Show a neat visual percentage completion for checklists on the card preview.", "", "", "Enhancement", demo_users[3]), # david
        ]
        for idx, (title, desc, email, phone, label_name, assignee) in enumerate(planned_cards):
            card = Card.objects.create(
                title=title,
                description=desc,
                list=roadmap_lists[1],
                created_by=admin_user,
                due_at=now + timedelta(days=10)
            )
            card.labels.add(labels[label_name])
            if assignee:
                card.members.add(assignee)

        # In Development
        dev_cards = [
            ("Real-time collaborative Board cursor highlights", "Render a smooth color cursor where other active workspace members are typing or editing.", "", "", "In Progress", demo_users[1]), # bob
            ("API Rate Limiting", "Implement django-ratelimit on workspace-related endpoints to prevent misuse.", "", "", "Bug / Critical", demo_users[2]), # charlie
        ]
        for idx, (title, desc, email, phone, label_name, assignee) in enumerate(dev_cards):
            card = Card.objects.create(
                title=title,
                description=desc,
                list=roadmap_lists[2],
                created_by=admin_user,
                due_at=now + timedelta(days=3)
            )
            card.labels.add(labels[label_name])
            if assignee:
                card.members.add(assignee)
            
            chk = Checklist.objects.create(card=card, name="Subtasks", position=0)
            ChecklistItem.objects.create(checklist=chk, text="Add Django middleware", completed=True, position=0)
            ChecklistItem.objects.create(checklist=chk, text="Set up Redis cache limits", completed=False, position=1)
            ChecklistItem.objects.create(checklist=chk, text="Write API response test cases", completed=False, position=2)

        # QA Testing
        qa_cards = [
            ("Workspace Archive & Restore features", "Fix a bug where archived cards are still showing up in main workspace search results.", "", "", "Bug / Critical", demo_users[3]), # david
        ]
        for idx, (title, desc, email, phone, label_name, assignee) in enumerate(qa_cards):
            card = Card.objects.create(
                title=title,
                description=desc,
                list=roadmap_lists[3],
                created_by=admin_user,
                due_at=now - timedelta(hours=2) # Overdue by 2 hours
            )
            card.labels.add(labels[label_name])
            card.labels.add(labels["Blocked"])
            if assignee:
                card.members.add(assignee)
            
            Comment.objects.create(card=card, user=demo_users[3], text="We found a edge case with nested comments. Fixing it now.")

        # Shipped
        shipped_cards = [
            ("Dnd-kit board integration", "Migrate board list dragging from React-Beautiful-Dnd to @dnd-kit.", "", "", "Feature", demo_users[0]), # alice
        ]
        for idx, (title, desc, email, phone, label_name, assignee) in enumerate(shipped_cards):
            card = Card.objects.create(
                title=title,
                description=desc,
                list=roadmap_lists[4],
                created_by=admin_user,
                due_at=now - timedelta(days=2)
            )
            card.labels.add(labels[label_name])
            if assignee:
                card.members.add(assignee)

        # Create activities for both boards
        for board in [sales_board, mkt_board, roadmap_board]:
            Activity.objects.create(
                board=board,
                user=admin_user,
                action_type="list_created",
                description="System created default demo lists."
            )
            Activity.objects.create(
                board=board,
                user=admin_user,
                action_type="card_created",
                description="Demo cards seeded successfully."
            )

        self.stdout.write(self.style.SUCCESS('Successfully seeded database with presentation demo data!'))
