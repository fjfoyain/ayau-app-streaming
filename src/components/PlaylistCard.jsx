export default function PlaylistCard({ playlist, onSelect }) {
  return (
    <div
      onClick={() => onSelect(playlist)}
      className="relative w-48 h-48 lg:w-64 lg:h-64 bg-black rounded-2xl overflow-hidden cursor-pointer
        transition-all duration-300 hover:scale-105 border-3 border-ayau-gold
        hover:border-ayau-gold-light hover:shadow-2xl hover:shadow-ayau-gold/20"
    >
      {/* Cover Image */}
      {playlist.cover_image_url ? (
        <img
          src={playlist.cover_image_url}
          alt={playlist.name}
          className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
          <span className="text-6xl lg:text-7xl">🎵</span>
        </div>
      )}

      {/* Overlay with playlist name */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent p-5">
        <h3 className="text-ayau-gold font-bold text-xl lg:text-2xl truncate uppercase">
          {playlist.name}
        </h3>
        {playlist.description && (
          <p className="text-ayau-gold/70 text-sm truncate mt-1">{playlist.description}</p>
        )}
      </div>
    </div>
  );
}
