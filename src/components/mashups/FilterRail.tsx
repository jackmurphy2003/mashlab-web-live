import React from 'react';
import { useMashups } from '../../store/mashups';
import ArtistAutocomplete from './ArtistAutocomplete';
import LibraryArtistDropdown from './LibraryArtistDropdown';
import CollectionsArtistDropdown from './CollectionsArtistDropdown';
import GenreChipSelect from './GenreChipSelect';

const colors = {
  bgPanel: "#0E1530",
  border: "#1A2348",
  text: "#E8EDFF",
  muted: "#96A0C2",
  muted2: "#6F7BA6",
  pillBorder: "#8A7CFF",
  pillBg: "rgba(138,124,255,0.12)",
  pillSolid: "#8A7CFF",
  pillSolidText: "#0B0F22",
  divider: "rgba(255,255,255,0.08)"
};

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
}

function ToggleRow({ label, checked, onChange, children }: ToggleRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-2"
          style={{ borderColor: colors.pillBorder }}
        />
        <label className="text-sm font-medium" style={{ color: colors.text }}>
          {label}
        </label>
      </div>
      {checked && children && (
        <div className="ml-6">
          {children}
        </div>
      )}
    </div>
  );
}


export default function FilterRail() {
  const { criteria, setCriteria, source } = useMashups();

  return (
    <div className="rounded-2xl border px-4 md:px-5 py-4 sticky top-6 h-fit" style={{ background: colors.bgPanel, borderColor: colors.border }}>
      {/* Filters Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: colors.pillBorder }}>
          <div className="w-2 h-2 rounded-full mx-auto mt-0.5" style={{ background: colors.pillBorder }} />
        </div>
        <span className="text-sm font-medium" style={{ color: colors.text }}>
          Filters
        </span>
      </div>

      {/* Search Input */}
      <div className="space-y-2 mb-4">
        <div className="text-sm font-medium" style={{ color: colors.text }}>
          Search
        </div>
        <input
          type="text"
          placeholder="Search tracks..."
          value={criteria.query || ''}
          onChange={(e) => setCriteria({ query: e.target.value })}
          className="w-full h-8 px-3 rounded border text-sm outline-none"
          style={{ 
            background: "#0F1836", 
            color: colors.text, 
            borderColor: "#222C55"
          }}
        />
      </div>

      {/* Divider */}
      <div className="h-px mb-3" style={{ background: colors.divider }} />

      {/* Same Key Toggle */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={criteria.keyOn}
            onChange={(e) => setCriteria({ keyOn: e.target.checked })}
            className="w-4 h-4 rounded border-2"
            style={{ borderColor: colors.pillBorder }}
          />
          <label className="text-sm font-medium" style={{ color: colors.text }}>
            Same key
          </label>
        </div>
        {criteria.keyOn && (
          <div className="ml-6">
            <div className="text-sm" style={{ color: colors.muted }}>
              Match the key of the seed track
            </div>
          </div>
        )}
      </div>



      {/* Artist */}
      <ToggleRow
        label="Artist"
        checked={criteria.artistOn ?? false}
        onChange={(checked) => setCriteria({ artistOn: checked })}
      >
        {source === 'library' ? (
          <LibraryArtistDropdown
            disabled={!criteria.artistOn}
            value={criteria.artistIds ?? []}
            onChange={(artistNames) => setCriteria({ artistIds: artistNames })}
          />
        ) : source === 'collections' ? (
          <CollectionsArtistDropdown
            disabled={!criteria.artistOn}
            value={criteria.artistIds ?? []}
            onChange={(artistNames) => setCriteria({ artistIds: artistNames })}
          />
        ) : (
          <ArtistAutocomplete
            disabled={!criteria.artistOn}
            value={criteria.artistIds ?? []}
            onChange={(ids) => setCriteria({ artistIds: ids })}
            source={source}
          />
        )}
      </ToggleRow>

      {/* Genre */}
      <ToggleRow
        label="Genre"
        checked={criteria.genresOn ?? false}
        onChange={(checked) => setCriteria({ genresOn: checked })}
      >
        <GenreChipSelect
          disabled={!criteria.genresOn}
          values={criteria.genres ?? []}
          onChange={(vals) => setCriteria({ genres: vals })}
          source={source}
        />
      </ToggleRow>

      {/* Checkboxes */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={criteria.excludeSameArtist}
            onChange={(e) => setCriteria({ excludeSameArtist: e.target.checked })}
            className="w-4 h-4 rounded border-2"
            style={{ borderColor: colors.pillBorder }}
          />
          <label className="text-sm font-medium" style={{ color: colors.text }}>
            Exclude same artist
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={true}
            className="w-4 h-4 rounded border-2 opacity-50"
            style={{ borderColor: colors.muted2 }}
          />
          <label className="text-sm font-medium" style={{ color: colors.muted }}>
            Explicit - Coming Soon!
          </label>
        </div>
      </div>

    </div>
  );
}
