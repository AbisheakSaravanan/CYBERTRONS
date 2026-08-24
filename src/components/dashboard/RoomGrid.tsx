import { useStore } from '../../store/useStore';
import { RoomCard } from './RoomCard';

export function RoomGrid() {
  const rooms = useStore((s) => s.rooms);
  const wardFilter = useStore((s) => s.wardFilter);

  const filtered = wardFilter === 'All' ? rooms : rooms.filter((r) => r.ward === wardFilter);

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
      {filtered.map((room) => (
        <RoomCard key={room.id} room={room} />
      ))}
    </div>
  );
}
