from channels.generic.websocket import AsyncJsonWebsocketConsumer
import json
import logging
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope['user']
        if user.is_anonymous:
            logger.warning("Anonymous user attempted notification WebSocket connection")
            await self.close()
            return
        self.user = user
        self.group_name = f'user_{user.id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f"Notification WebSocket connected for user {user.username}")

    async def disconnect(self, close_code):
        logger.info(f"Notification WebSocket disconnected (code: {close_code})")
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notify(self, event):
        logger.debug(f"NotificationConsumer.notify() called")
        payload = event.get('data', {})
        await self.send_json(payload)


class BoardConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for real-time board updates.
    Handles connections to specific boards and broadcasts events to all connected clients.
    """
    
    async def connect(self):
        """Handle new WebSocket connection"""
        self.board_id = self.scope['url_route']['kwargs']['board_id']
        self.board_group_name = f'board_{self.board_id}'
        self.user = self.scope.get('user')
        
        # Log connection attempt
        logger.debug(f"WebSocket connection attempt for board {self.board_id}")
        
        # Reject anonymous users
        if not self.user or getattr(self.user, 'is_anonymous', True):
            logger.warning(f"Rejecting anonymous user connection")
            await self.close()
            return
            
        # ── L-3 FIX: Verify board access before accepting the connection
        from crm.models import Board
        from crm.permissions import user_can_access_board
        
        try:
            board = await database_sync_to_async(Board.objects.get)(id=self.board_id)
            has_access = await database_sync_to_async(user_can_access_board)(self.user, board, min_role='VIEWER')
            if not has_access:
                logger.warning(f"User {self.user.username} denied access to board {self.board_id}")
                await self.close()
                return
        except Board.DoesNotExist:
            logger.warning(f"Board {self.board_id} does not exist")
            await self.close()
            return
        
        # Join board group
        await self.channel_layer.group_add(
            self.board_group_name,
            self.channel_name
        )
        
        await self.accept()
        logger.info(f"WebSocket accepted for user {self.user.username} on board {self.board_id}")
        
        # Send initial connection message
        await self.send_json({
            'type': 'connection_established',
            'message': f'Connected to board {self.board_id}',
            'user_id': self.user.id,
            'username': self.user.username
        })
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        logger.info(f"WebSocket disconnecting with code {close_code}")
        # Leave board group
        if hasattr(self, 'board_group_name'):
            await self.channel_layer.group_discard(
                self.board_group_name,
                self.channel_name
            )
    
    async def receive_json(self, content):
        """
        Receive message from WebSocket (client -> server)
        Currently used for presence/typing indicators
        """
        message_type = content.get('type')
        
        if message_type == 'ping':
            # Respond to ping with pong
            await self.send_json({'type': 'pong'})
    
    # ========== Event Handlers (server -> client) ==========
    # These methods handle events broadcast from Django views
    
    async def card_moved(self, event):
        """Broadcast card move event to client"""
        await self.send_json(event)
    
    async def card_created(self, event):
        """Broadcast card creation event to client"""
        await self.send_json(event)
    
    async def card_updated(self, event):
        """Broadcast card update event to client"""
        await self.send_json(event)
    
    async def card_deleted(self, event):
        """Broadcast card deletion event to client"""
        await self.send_json(event)
    
    async def card_archived(self, event):
        """Broadcast card archive event to client"""
        await self.send_json(event)
    
    async def card_restored(self, event):
        """Broadcast card restore event to client"""
        await self.send_json(event)
    
    async def list_created(self, event):
        """Broadcast list creation event to client"""
        await self.send_json(event)
    
    async def list_updated(self, event):
        """Broadcast list update event to client"""
        await self.send_json(event)
    
    async def list_deleted(self, event):
        """Broadcast list deletion event to client"""
        await self.send_json(event)
    
    async def comment_added(self, event):
        """Broadcast comment addition event to client"""
        await self.send_json(event)
    
    async def comment_updated(self, event):
        """Broadcast comment update event to client"""
        await self.send_json(event)
    
    async def comment_deleted(self, event):
        """Broadcast comment deletion event to client"""
        await self.send_json(event)
    
    async def member_added(self, event):
        """Broadcast member added event to client"""
        await self.send_json(event)
    
    async def member_removed(self, event):
        """Broadcast member removed event to client"""
        await self.send_json(event)
    
    async def member_role_changed(self, event):
        """Broadcast member role changed event to client"""
        await self.send_json(event)
    
    async def checklist_created(self, event):
        """Broadcast checklist creation event to client"""
        await self.send_json(event)
    
    async def checklist_updated(self, event):
        """Broadcast checklist update event to client"""
        await self.send_json(event)
    
    async def checklist_deleted(self, event):
        """Broadcast checklist deletion event to client"""
        await self.send_json(event)
    
    async def checklist_item_created(self, event):
        """Broadcast checklist item creation event to client"""
        await self.send_json(event)
    
    async def checklist_item_updated(self, event):
        """Broadcast checklist item update event to client"""
        await self.send_json(event)
    
    async def checklist_item_deleted(self, event):
        """Broadcast checklist item deletion event to client"""
        await self.send_json(event)
    
    async def list_moved(self, event):
        """Broadcast list moved event to client"""
        await self.send_json(event)


