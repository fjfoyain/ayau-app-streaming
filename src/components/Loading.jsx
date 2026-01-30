import React from 'react';
import CircularProgress from '@mui/material/CircularProgress';

export default function Loading() {
  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="bg-white p-10 rounded-lg shadow-lg flex flex-col items-center">
        <CircularProgress />
        <p className="mt-4 text-black">Loading...</p>
      </div>
    </div>
  );
}
