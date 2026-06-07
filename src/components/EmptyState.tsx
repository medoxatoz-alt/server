import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface EmptyStateProps {
  message: string;
}

export default function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 w-full min-h-[300px]">
      <div className="w-[200px] h-[200px]">
        <DotLottieReact
          src="https://lottie.host/de4513a2-a49c-49fc-b21f-fcbb94def747/5JuXcx49eI.lottie"
          loop
          autoplay
        />
      </div>
      <p className="mt-2 text-gray-500 font-bold text-lg">{message}</p>
    </div>
  );
}
