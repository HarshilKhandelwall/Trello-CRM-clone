import { useState } from 'react';
import { apiPost } from '../api';

export default function CreateCardModal({ listId, board, setBoard, onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dueAt, setDueAt] = useState('');

  const create = async () => {
    if (!title.trim()) return;

    const card = await apiPost('/api/cards/', {
      title,
      list: listId,
      description,
      email,
      phone,
      due_at: dueAt || null
    });

    setBoard({
      ...board,
      lists: board.lists.map(l =>
        l.id === listId ? { ...l, cards: [...l.cards, card] } : l
      )
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white w-96 rounded shadow-lg p-4">
        <h3 className="font-semibold mb-3">Create Card</h3>

        <input className="w-full border p-2 mb-2" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
        <textarea className="w-full border p-2 mb-2" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
        <input className="w-full border p-2 mb-2" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="w-full border p-2 mb-2" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
        <input type="datetime-local" className="w-full border p-2 mb-4" value={dueAt} onChange={e => setDueAt(e.target.value)} />

        <div className="flex justify-end gap-2">
          <button onClick={onClose}>Cancel</button>
          <button className="bg-blue-600 text-white px-3 py-1" onClick={create}>Create</button>
        </div>
      </div>
    </div>
  );
}
