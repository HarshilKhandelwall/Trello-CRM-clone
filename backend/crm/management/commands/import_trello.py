"""
Management command: import_trello

Imports a Trello board JSON export into the CRM project.

Usage:
    python manage.py import_trello <path_to_trello_export.json> --workspace <workspace_id> --user <username>

How to export from Trello:
    1. Open your Trello board
    2. Click "..." (Show menu) → "More" → "Print and export" → "Export as JSON"
    3. Save the downloaded .json file
    4. Run this command pointing to that file

What gets imported:
    - Board name & background color
    - Lists (columns)
    - Cards (title, description, due date, archived state)
    - Labels (name + color)
    - Checklists and checklist items
    - Comments (as text, attributed to the importing user)
"""

import json
import sys
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from crm.models import Workspace, Board, List, Card, Label, Checklist, ChecklistItem, Comment

User = get_user_model()

# Trello uses hex color names — map them to our label colors
TRELLO_COLOR_MAP = {
    'green':        '#61bd4f',
    'yellow':       '#f2d600',
    'orange':       '#ff9f1a',
    'red':          '#eb5a46',
    'purple':       '#c377e0',
    'blue':         '#0079bf',
    'sky':          '#00c2e0',
    'lime':         '#51e898',
    'pink':         '#ff78cb',
    'black':        '#344563',
    'green_dark':   '#519839',
    'yellow_dark':  '#d9b51c',
    'orange_dark':  '#cf7b00',
    'red_dark':     '#b04632',
    'purple_dark':  '#89609e',
    'blue_dark':    '#055a8c',
    'sky_dark':     '#0098b7',
    'lime_dark':    '#4bbf6b',
    'pink_dark':    '#c9558f',
    'black_dark':   '#091e42',
    None:           '#b3bac5',  # unlabelled
}


class Command(BaseCommand):
    help = 'Import a Trello board JSON export into the CRM project'

    def add_arguments(self, parser):
        parser.add_argument(
            'json_file',
            type=str,
            help='Path to the Trello board JSON export file',
        )
        parser.add_argument(
            '--workspace',
            type=int,
            required=True,
            help='ID of the Workspace to import the board into',
        )
        parser.add_argument(
            '--user',
            type=str,
            required=True,
            help='Username of the user who will own the imported data',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview what would be imported without saving anything',
        )

    def handle(self, *args, **options):
        json_path   = options['json_file']
        workspace_id = options['workspace']
        username    = options['user']
        dry_run     = options['dry_run']

        # ── Validate inputs ──────────────────────────────────────────────────
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError(f"User '{username}' not found.")

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            raise CommandError(f"Workspace with ID {workspace_id} not found.")

        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except FileNotFoundError:
            raise CommandError(f"File not found: {json_path}")
        except json.JSONDecodeError as e:
            raise CommandError(f"Invalid JSON file: {e}")

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — nothing will be saved.\n"))

        # ── Board ─────────────────────────────────────────────────────────────
        board_name  = data.get('name', 'Imported Trello Board')
        prefs       = data.get('prefs', {})
        bg_color    = prefs.get('backgroundColor') or '#0079BF'

        self.stdout.write(f"\n📋 Board: {board_name}")
        self.stdout.write(f"   Workspace: {workspace.name}")
        self.stdout.write(f"   Owner: {user.username}")
        self.stdout.write(f"   Background color: {bg_color}\n")

        if not dry_run:
            board = Board.objects.create(
                name=board_name,
                workspace=workspace,
                created_by=user,
                background_type='color',
                background_value=bg_color,
                background_brightness='dark',
            )
        else:
            board = None

        # ── Labels ────────────────────────────────────────────────────────────
        trello_labels = data.get('labels', [])
        label_map = {}  # trello label id → our Label object

        self.stdout.write(f"🏷️  Labels ({len(trello_labels)}):")
        for tl in trello_labels:
            color_key = tl.get('color')
            hex_color = TRELLO_COLOR_MAP.get(color_key, '#b3bac5')
            name      = tl.get('name') or color_key or 'Label'

            self.stdout.write(f"   • {name} ({hex_color})")

            if not dry_run:
                label, _ = Label.objects.get_or_create(
                    name=name,
                    color=hex_color,
                )
                label_map[tl['id']] = label

        # ── Lists (columns) ────────────────────────────────────────────────────
        trello_lists = [l for l in data.get('lists', []) if not l.get('closed')]
        # Sort by position field (Trello uses 'pos')
        trello_lists.sort(key=lambda x: x.get('pos', 0))

        self.stdout.write(f"\n📑 Lists ({len(trello_lists)}):")
        list_map = {}  # trello list id → our List object

        for position, tl in enumerate(trello_lists):
            name = tl['name']
            self.stdout.write(f"   {position + 1}. {name}")

            if not dry_run:
                lst = List.objects.create(
                    name=name,
                    board=board,
                    position=position,
                )
                list_map[tl['id']] = lst

        # ── Cards ─────────────────────────────────────────────────────────────
        trello_cards = data.get('cards', [])
        # Exclude cards in closed lists
        closed_list_ids = {l['id'] for l in data.get('lists', []) if l.get('closed')}
        active_cards    = [c for c in trello_cards if c.get('idList') not in closed_list_ids]

        self.stdout.write(f"\n🃏 Cards ({len(active_cards)} active, "
                          f"{len(trello_cards) - len(active_cards)} archived):")

        card_map = {}  # trello card id → our Card object

        for tc in trello_cards:
            list_id  = tc.get('idList')
            is_closed = tc.get('closed', False) or list_id in closed_list_ids

            # Parse due date
            due_at = None
            if tc.get('due'):
                try:
                    due_at = parse_datetime(tc['due'])
                    if due_at and timezone.is_naive(due_at):
                        due_at = timezone.make_aware(due_at)
                except Exception:
                    pass

            title = tc.get('name', 'Untitled Card')
            desc  = tc.get('desc', '')

            status = '(archived)' if is_closed else ''
            self.stdout.write(f"   • {title} {status}")

            if not dry_run:
                target_list = list_map.get(list_id)
                if not target_list:
                    # Card belongs to a closed list — still import to first list
                    target_list = list(list_map.values())[0] if list_map else None

                if not target_list:
                    self.stdout.write(self.style.WARNING(f"     ⚠ Skipped (no valid list found)"))
                    continue

                card = Card.objects.create(
                    title=title,
                    description=desc,
                    list=target_list,
                    created_by=user,
                    due_at=due_at,
                    archived=is_closed,
                    archived_at=timezone.now() if is_closed else None,
                    archived_by=user if is_closed else None,
                )

                # Assign labels to card
                for label_id in tc.get('idLabels', []):
                    if label_id in label_map:
                        card.labels.add(label_map[label_id])

                card_map[tc['id']] = card

        # ── Checklists ────────────────────────────────────────────────────────
        trello_checklists = data.get('checklists', [])
        self.stdout.write(f"\n✅ Checklists ({len(trello_checklists)}):")

        for position, tcl in enumerate(trello_checklists):
            card_id   = tcl.get('idCard')
            cl_name   = tcl.get('name', 'Checklist')
            items     = tcl.get('checkItems', [])
            items.sort(key=lambda x: x.get('pos', 0))

            self.stdout.write(f"   • {cl_name} ({len(items)} items)")

            if not dry_run and card_id in card_map:
                checklist = Checklist.objects.create(
                    card=card_map[card_id],
                    name=cl_name,
                    position=position,
                )
                for item_pos, item in enumerate(items):
                    ChecklistItem.objects.create(
                        checklist=checklist,
                        text=item.get('name', ''),
                        completed=(item.get('state') == 'complete'),
                        position=item_pos,
                    )

        # ── Comments (actions of type commentCard) ────────────────────────────
        actions         = data.get('actions', [])
        comment_actions = [a for a in actions if a.get('type') == 'commentCard']
        self.stdout.write(f"\n💬 Comments ({len(comment_actions)}):")

        for action in comment_actions:
            card_id = action.get('data', {}).get('card', {}).get('id')
            text    = action.get('data', {}).get('text', '')
            author  = action.get('memberCreator', {}).get('fullName', 'Unknown')
            # Prefix comment with original Trello author name
            full_text = f"[{author}] {text}"

            self.stdout.write(f"   • {full_text[:60]}...")

            if not dry_run and card_id in card_map:
                Comment.objects.create(
                    card=card_map[card_id],
                    user=user,
                    text=full_text,
                )

        # ── Summary ───────────────────────────────────────────────────────────
        self.stdout.write('\n' + '─' * 50)
        if dry_run:
            self.stdout.write(self.style.WARNING(
                "\n✅ Dry run complete. Run without --dry-run to import."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"\n✅ Import complete!\n"
                f"   Board '{board_name}' created in workspace '{workspace.name}'.\n"
                f"   {len(list_map)} lists, {len(card_map)} cards, "
                f"{len(trello_checklists)} checklists, {len(comment_actions)} comments imported."
            ))
