import React, { useState } from 'react';
import { apiFetch } from '../../lib/apiClient';

interface BPMKeyFixerProps {
  spotifyId: string;
  currentBpm: number | null;
  currentKey: string | null;
  onUpdate: (bpm: number | null, keyNum: number | null, mode: number | null) => void;
}

const keyNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const modeNames = ["minor", "major"];

export const BPMKeyFixer: React.FC<BPMKeyFixerProps> = ({ 
  spotifyId, 
  currentBpm, 
  currentKey, 
  onUpdate 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [bpm, setBpm] = useState<number | null>(currentBpm);
  const [keyNum, setKeyNum] = useState<number>(0);
  const [mode, setMode] = useState<number>(1);
  const [reason, setReason] = useState<string>('');

  const handleSave = async () => {
    try {
      const response = await apiFetch('/api/qc/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spotifyId,
          bpm,
          keyNum,
          mode: mode === 0 || mode === 1 ? mode : 1, // Ensure mode is 0 or 1
          reason: reason || 'Manual fix'
        })
      });

      if (response.ok) {
        onUpdate(bpm, keyNum, mode === 0 || mode === 1 ? mode : 1);
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to save override:', error);
    }
  };

  const handleClear = async () => {
    try {
      const response = await apiFetch('/api/qc/override', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotifyId })
      });

      if (response.ok) {
        onUpdate(null, null, null);
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to clear override:', error);
    }
  };

  const handleHalfSpeed = () => {
    if (bpm) setBpm(Math.round(bpm / 2));
  };

  const handleDoubleSpeed = () => {
    if (bpm) setBpm(Math.round(bpm * 2));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-500 hover:text-gray-700 p-1 rounded"
        title="Fix BPM/Key"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-4">
          <h3 className="text-sm font-medium mb-3">Fix BPM/Key</h3>
          
          <div className="space-y-3">
            {/* BPM Section */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                BPM
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  value={bpm || ''}
                  onChange={(e) => setBpm(e.target.value ? parseInt(e.target.value) : null)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                  placeholder="BPM"
                />
                <button
                  onClick={handleHalfSpeed}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  title="Half speed"
                >
                  ×0.5
                </button>
                <button
                  onClick={handleDoubleSpeed}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  title="Double speed"
                >
                  ×2
                </button>
              </div>
            </div>

            {/* Key Section */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Key
              </label>
              <div className="flex space-x-2">
                <select
                  value={keyNum}
                  onChange={(e) => setKeyNum(parseInt(e.target.value))}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                >
                  {keyNames.map((key, index) => (
                    <option key={index} value={index}>{key}</option>
                  ))}
                </select>
                <select
                  value={mode}
                  onChange={(e) => setMode(parseInt(e.target.value))}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                >
                  {modeNames.map((modeName, index) => (
                    <option key={index} value={index}>{modeName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                placeholder="Why this fix?"
              />
            </div>

            {/* Actions */}
            <div className="flex space-x-2 pt-2">
              <button
                onClick={handleSave}
                className="flex-1 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
              <button
                onClick={handleClear}
                className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
