import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { FilterProvider } from './context/FilterContext';
import { BoardProvider } from './context/BoardContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { NotificationWebSocketProvider } from './context/NotificationWebSocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WorkspaceSettings from './pages/WorkspaceSettings';
import AppHeader from './components/layout/AppHeader';
import WorkspaceSidebar from './components/layout/WorkspaceSidebar';
import BoardContainer from './components/layout/BoardContainer';
import { workspaces as workspacesAPI } from './api/endpoints';
import './App.css';

function MainApp() {
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [currentBoard, setCurrentBoard] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const data = await workspacesAPI.list();
      setWorkspaces(data || []);
      if (data && data.length > 0) {
        setCurrentWorkspace(data[0]);
        if (data[0].boards && data[0].boards.length > 0) {
          setCurrentBoard(data[0].boards[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceChange = (workspace) => {
    setCurrentWorkspace(workspace);
    if (workspace.boards && workspace.boards.length > 0) {
      setCurrentBoard(workspace.boards[0]);
    } else {
      setCurrentBoard(null);
    }
  };

  const handleBoardChange = (board) => {
    setCurrentBoard(board);
  };

  const handleBoardCreated = async (newBoard) => {
    // Reload workspaces to get updated board list
    const data = await workspacesAPI.list();
    setWorkspaces(data || []);

    // Find and update the current workspace
    const updatedWorkspace = data?.find(ws => ws.id === currentWorkspace?.id);
    if (updatedWorkspace) {
      setCurrentWorkspace(updatedWorkspace);
    }

    // Select the newly created board
    setCurrentBoard(newBoard);
  };

  const handleBoardDelete = async (boardId) => {
    try {
      // Find the workspace that contains this board
      const workspace = workspaces.find(ws =>
        ws.boards?.some(b => b.id === boardId)
      );

      if (!workspace) return;

      // Navigate to another board or null
      const remainingBoards = workspace.boards.filter(b => b.id !== boardId);
      if (remainingBoards.length > 0) {
        setCurrentBoard(remainingBoards[0]);
      } else {
        setCurrentBoard(null);
      }

      // Reload workspaces to sync with backend
      await loadWorkspaces();
    } catch (error) {
      console.error('Failed to delete board:', error);
    }
  };

  const handleWorkspaceCreated = async (newWorkspace) => {
    // Reload workspaces
    const data = await workspacesAPI.list();
    setWorkspaces(data || []);

    // Select the newly created workspace
    setCurrentWorkspace(newWorkspace);
    setCurrentBoard(null);
  };

  const handleBoardSelectFromSearch = (boardId, _cardId) => {
    // Find the board across all workspaces and switch to it
    for (const ws of workspaces) {
      const found = ws.boards?.find(b => b.id === boardId);
      if (found) {
        setCurrentWorkspace(ws);
        setCurrentBoard(found);
        return;
      }
    }
    // Board not found in loaded workspaces — reload and try again
    workspacesAPI.list().then(data => {
      setWorkspaces(data || []);
      for (const ws of data || []) {
        const found = ws.boards?.find(b => b.id === boardId);
        if (found) {
          setCurrentWorkspace(ws);
          setCurrentBoard(found);
          return;
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <WebSocketProvider boardId={currentBoard?.id}>
      <NotificationWebSocketProvider>
        <div className="app">
          <AppHeader
            workspace={currentWorkspace}
            workspaces={workspaces}
            board={currentBoard}
            onWorkspaceChange={handleWorkspaceChange}
            onWorkspaceCreated={handleWorkspaceCreated}
            onBoardSelect={handleBoardSelectFromSearch}
          />

          <div className="app-main">
            <WorkspaceSidebar
              workspace={currentWorkspace}
              workspaces={workspaces}
              currentBoard={currentBoard}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              onWorkspaceChange={handleWorkspaceChange}
              onBoardSelect={handleBoardChange}
              onBoardCreated={handleBoardCreated}
            />

            <BoardProvider initialBoard={currentBoard} onBoardDelete={handleBoardDelete}>
              <BoardContainer sidebarCollapsed={sidebarCollapsed} />
            </BoardProvider>
          </div>
        </div>
      </NotificationWebSocketProvider>
    </WebSocketProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FilterProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/workspaces/:workspaceId/settings"
              element={
                <ProtectedRoute>
                  <WorkspaceSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <MainApp />
                </ProtectedRoute>
              }
            />
          </Routes>
        </FilterProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
