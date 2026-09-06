import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface ErrorStateProps {
  message?: string;
}

export default function ErrorState({ message = "Something went wrong." }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 w-full min-h-[300px]">
      <div className="w-[200px] h-[200px]">
        <DotLottieReact
          src="https://lottie.host/94129b5d-23c9-4c70-a746-7b3a4d1da50c/y2424zHnAl.lottie"
          loop
          autoplay
        />
      </div>
      <p className="mt-2 text-red-500 font-bold text-lg">{message}</p>
    </div>
  );
}
