'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

interface ParsedStreamData {
  recipient: string;
  amount: string;
  duration: number;
  durationUnit: 'seconds' | 'minutes' | 'hours' | 'days';
  streamType?: string;
  description?: string;
}

interface NLPStreamInputProps {
  onParsed: (data: ParsedStreamData) => void;
}

export default function NLPStreamInput({ onParsed }: NLPStreamInputProps) {
  const [nlpInput, setNlpInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleParse = async () => {
    if (!nlpInput.trim()) {
      toast.error('Please enter a stream description');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/parse-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nlpInput })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Parsing failed');
      }

      const data = await response.json();
      onParsed(data);
      toast.success('✨ Stream details parsed! Review and confirm below.');
      setNlpInput(''); // Clear input after successful parse
    } catch (error: any) {
      toast.error(error.message || 'Failed to parse. Please fill the form manually.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/20"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-purple-400" />
        <h2 className="text-xl font-semibold text-white">AI-Powered Stream Creation</h2>
      </div>
      <p className="text-gray-400 text-sm mb-4">
        Describe your stream in plain English, and we'll fill out the form for you.
      </p>
      
      <div className="space-y-3">
        <textarea
          value={nlpInput}
          onChange={(e) => setNlpInput(e.target.value)}
          placeholder='Example: "Send 0.5 ETH to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb for 2 hours for design work"'
          className="w-full px-4 py-3 rounded-lg bg-black/40 border border-purple-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
          rows={3}
          disabled={isProcessing}
        />
        
        <button
          onClick={handleParse}
          disabled={isProcessing || !nlpInput.trim()}
          className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Parsing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Parse with AI
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
