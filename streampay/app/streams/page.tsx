'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useUserStreams, useStreamInfo, useWithdrawFromStream, useCancelStream,
} from '@/hooks/useStreamContract';
import { formatWeiToEther } from '@/lib/utils';
import {
  Download, XCircle, Loader2, Inbox, Send,
  ArrowDownToLine, Clock, Zap,
} from 'lucide-react';

export default function StreamsPage() {
  const { address, isConnected } = useAccount();
  const { sentStreams, receivedStreams } = useUserStreams(address);
  const [tab, setTab] = useState<'received' | 'sent'>('received');

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-muted-foreground">
        <Zap className="h-12 w-12 text-purple-400" />
        <p className="text-lg font-medium">Connect your wallet to view streams</p>
      </div>
    );
  }

  const ids = tab === 'received' ? receivedStreams : sentStreams;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          My Streams
        </h1>
        <p className="text-muted-foreground text-sm">View, withdraw, or cancel your payment streams</p>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2 border rounded-lg p-1 w-fit mx-auto">
        <button
          onClick={() => setTab('received')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'received' ? 'bg-purple-600 text-white' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Inbox className="h-4 w-4" />
          Incoming ({receivedStreams.length})
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'sent' ? 'bg-purple-600 text-white' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Send className="h-4 w-4" />
          Outgoing ({sentStreams.length})
        </button>
      </div>

      {ids.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No {tab === 'received' ? 'incoming' : 'outgoing'} streams found for this wallet.</p>
          </CardContent>
        </Card>
      ) : (
        <AnimatePresence>
          {ids.map((id) => (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <StreamCard streamId={id} mode={tab} />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

function StreamCard({ streamId, mode }: { streamId: number; mode: 'received' | 'sent' }) {
  const { streamInfo, isLoading, refetch } = useStreamInfo(streamId);
  const { withdrawFromStream, isPending: withdrawing } = useWithdrawFromStream();
  const { cancelStream, isPending: cancelling } = useCancelStream();

  // Tick the displayed withdrawable amount every second
  const [withdrawable, setWithdrawable] = useState<bigint>(0n);

  useEffect(() => {
    if (!streamInfo?.isActive) return;
    const tick = () => {
      const now = BigInt(Math.floor(Date.now() / 1000));
      const elapsed = now > streamInfo.startTime ? now - streamInfo.startTime : 0n;
      const streamed = elapsed * streamInfo.flowRate;
      const clampedStreamed = streamed > streamInfo.totalAmount ? streamInfo.totalAmount : streamed;
      // withdrawable = streamed so far minus what's already been withdrawn
      const alreadyWithdrawn = streamInfo.totalAmount - streamInfo.currentBalance;
      const w = clampedStreamed > alreadyWithdrawn ? clampedStreamed - alreadyWithdrawn : 0n;
      setWithdrawable(w);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [streamInfo]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!streamInfo) return null;

  const totalSTT = formatWeiToEther(streamInfo.totalAmount, 4);
  const balanceSTT = formatWeiToEther(streamInfo.currentBalance, 4);
  const withdrawableSTT = formatWeiToEther(withdrawable, 6);
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - Number(streamInfo.startTime));
  const total = Math.max(1, Number(streamInfo.stopTime) - Number(streamInfo.startTime));
  const progress = Math.min(100, (elapsed / total) * 100);

  async function handleWithdraw() {
    await withdrawFromStream(streamId);
    refetch();
  }

  async function handleCancel() {
    await cancelStream(streamId);
    refetch();
  }

  return (
    <Card className={`border ${streamInfo.isActive ? 'border-purple-500/30' : 'border-muted'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-mono text-muted-foreground">Stream #{streamId}</CardTitle>
            <p className="text-base font-semibold mt-0.5">{streamInfo.description || 'Payment Stream'}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-[10px]">{streamInfo.streamType || 'work'}</Badge>
            <Badge className={`text-[10px] ${streamInfo.isActive ? 'bg-green-500' : 'bg-muted text-muted-foreground'}`}>
              {streamInfo.isActive ? 'Active' : 'Ended'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Addresses */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground mb-1">From</p>
            <p className="font-mono truncate">{streamInfo.sender}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">To</p>
            <p className="font-mono truncate">{streamInfo.recipient}</p>
          </div>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">Total</p>
            <p className="text-sm font-bold">{totalSTT} STT</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">Remaining</p>
            <p className="text-sm font-bold">{balanceSTT} STT</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${streamInfo.isActive ? 'bg-green-500/10 border border-green-500/30' : 'bg-muted/30'}`}>
            <p className="text-[10px] text-muted-foreground mb-1">Withdrawable</p>
            <p className={`text-sm font-bold ${streamInfo.isActive ? 'text-green-400' : ''}`}>
              {withdrawableSTT} STT
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Progress</span>
            <span>{progress.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {mode === 'received' && streamInfo.isActive && (
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleWithdraw}
              disabled={withdrawing || withdrawable === 0n}
            >
              {withdrawing ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <ArrowDownToLine className="h-3 w-3 mr-1" />
              )}
              Withdraw {withdrawableSTT} STT
            </Button>
          )}

          {mode === 'sent' && streamInfo.isActive && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-3 w-3 mr-1" />
              )}
              Cancel Stream
            </Button>
          )}

          {!streamInfo.isActive && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Download className="h-3 w-3" /> Stream ended — all funds distributed
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
