import React from 'react';
import { WinoraGameConfig, GameRound, UserProfile } from '../types.ts';
import { GameBoardModal } from './GameBoardModal.tsx';

export interface BiddingEngineModalProps {
  game: WinoraGameConfig;
  round: GameRound;
  user: UserProfile;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

export const BiddingEngineModal: React.FC<BiddingEngineModalProps> = ({
  game,
  round,
  user,
  onClose,
  onSuccessToast,
}) => {
  return (
    <GameBoardModal
      game={game}
      initialRound={round}
      user={user}
      onClose={onClose}
      onSuccessToast={onSuccessToast}
    />
  );
};

export { GameBoardModal };
