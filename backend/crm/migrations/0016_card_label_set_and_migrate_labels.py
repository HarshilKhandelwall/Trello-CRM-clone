# Generated manually to convert Card.labels from JSONField to ManyToManyField

from django.db import migrations, models
import json


def migrate_labels_to_m2m(apps, schema_editor):
    """
    Migrate labels from JSONField to ManyToManyField relationship.
    This reads existing label data from the JSON field and creates proper relationships.
    """
    Card = apps.get_model('crm', 'Card')
    Label = apps.get_model('crm', 'Label')
    
    cards_with_labels = Card.objects.exclude(labels=[])
    migrated_count = 0
    
    for card in cards_with_labels:
        if not card.labels:
            continue
            
        # Get the board to find matching labels
        board = card.list.board
        
        # card.labels is a JSONField containing array of label objects like:
        # [{'id': 1, 'name': 'Bug', 'color': '#eb5a46'}, ...]
        for label_data in card.labels:
            if isinstance(label_data, dict):
                # Try to find existing label by ID
                label_id = label_data.get('id')
                if label_id:
                    try:
                        label = Label.objects.get(id=label_id, board=board)
                        card.label_set.add(label)
                        migrated_count += 1
                    except Label.DoesNotExist:
                        # Label doesn't exist anymore, create it
                        label = Label.objects.create(
                            board=board,
                            name=label_data.get('name', 'Unnamed'),
                            color=label_data.get('color', '#61bd4f')
                        )
                        card.label_set.add(label)
                        migrated_count += 1
    
    print(f"Migrated {migrated_count} label relationships")


def reverse_migration(apps, schema_editor):
    """
    Reverse migration: Convert ManyToMany relationships back to JSON.
    """
    Card = apps.get_model('crm', 'Card')
    
    for card in Card.objects.all():
        labels_data = []
        for label in card.label_set.all():
            labels_data.append({
                'id': label.id,
                'name': label.name,
                'color': label.color
            })
        card.labels = labels_data
        card.save(update_fields=['labels'])


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0015_alter_label_options_label_board_label_created_at_and_more'),
    ]

    operations = [
        # Add the ManyToManyField (named label_set to avoid conflict with existing labels field)
        migrations.AddField(
            model_name='card',
            name='label_set',
            field=models.ManyToManyField(blank=True, related_name='cards', to='crm.label'),
        ),
        # Migrate data from JSON to ManyToMany
        migrations.RunPython(migrate_labels_to_m2m, reverse_migration),
        # Remove the old JSONField
        migrations.RemoveField(
            model_name='card',
            name='labels',
        ),
        # Rename label_set to labels
        migrations.RenameField(
            model_name='card',
            old_name='label_set',
            new_name='labels',
        ),
    ]
