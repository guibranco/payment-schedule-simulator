import React, { useState } from 'react';
import { FileUp, Calendar, ArrowRight, Clipboard } from 'lucide-react';
import { PaymentScheduleInput, PaymentScheduleResponse } from '../types';
import NewSchedule from './NewSchedule';
import ScheduleDisplay from './ScheduleDisplay';

interface Props {
  apiEndpoint: string;
}

/**
 * Handles file upload and manages schedule state.
 */
export default function AmendSchedule({ apiEndpoint }: Props) {
  const [existingSchedule, setExistingSchedule] = useState<PaymentScheduleResponse | null>(null);
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [showPasteInput, setShowPasteInput] = useState(false);

  /**
   * Handles file upload by retrieving the selected file from an input event.
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
  }
}