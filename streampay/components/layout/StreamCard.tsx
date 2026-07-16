'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStreamInfo, useRealTimeBalance, useWithdrawFromStream, useCancelStream } from '@/hooks/useStreamContract';
import { useAccount } from 'wagmi';
import { 
  formatAddress, 
  formatDuration, 
  formatTimeRemaining, 
  formatWeiToEther, 
  calculateProgress,
  getStreamTypeColor,
  getStreamTypeIcon 
} from '@/lib/utils';
import { 
  Clock, 
  TrendingUp, 
  Download, 
  X, 
  Play, 
  Pause,
  ExternalLink 
} from 'lucide-react';
import { NETWORK_CONFIG } from '@/lib/contracts';

interface StreamCardProps {
  streamId: number;
  isReceived?: boolean;
}

export default function StreamCard({ streamId, isReceived = false }: StreamCardProps) {
  const { address } = useAccount();
  const { streamInfo, isLoading, refetch: refetchStreamInfo } = useStreamInfo(streamId);
  const { balance: realTimeBalance, refetchBalance } = useRealTimeBalance(streamId);
  const { withdrawFromStream, isPending: isWithdrawing } = useWithdrawFromStream();
  const { cancelStream, isPending: isCancelling } = useCancelStream();

  // Use contract balance directly
  const displayBalance = realTimeBalance;

  const handleWithdraw = async () => {
    try {
      await withdrawFromStream(streamId);
      
      // Refetch both stream info and balance
      refetchStreamInfo();
      refetchBalance();
      
      // Force multiple refreshes
      setTimeout(() => {
        refetchStreamInfo();
        refetchBalance();
      }, 2000);
      
    } catch (error) {
      console.error('Withdraw failed:', error);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelStream(streamId);
      refetchStreamInfo();
      refetchBalance();
    } catch (error) {
      console.error('Cancel failed:', error);
    }
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
            <div className="h-8 bg-muted rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!streamInfo) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <p className="text-destructive">Failed to load stream data</p>
        </CardContent>
      </Card>
    );
  }

  const progress = calculateProgress(
    Number(streamInfo.startTime),
    Number(streamInfo.stopTime)
  );
  
  // Use displayBalance as withdrawable amount
  const withdrawableAmount = displayBalance;
  const canWithdraw = isReceived && withdrawableAmount > 0n && streamInfo.isActive;
  const canCancel = address === streamInfo.sender || address === streamInfo.recipient;

  const streamTypeColor = getStreamTypeColor(streamInfo.streamType);
  const streamTypeIcon = getStreamTypeIcon(streamInfo.streamType);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-somnia-500/10">
        {/* Stream Status Indicator */}
        <div className="absolute top-0 left-0 right-0 h-1">
          <div 
            className={`h-full transition-all duration-1000 ${
              streamInfo.isActive ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gray-400'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
          {streamInfo.isActive && (
            <div className="absolute top-0 left-0 right-0 h-full overflow-hidden">
              <div className="h-full w-8 bg-white/30 animate-stream-flow" />
            </div>
          )}
        </div>

        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2 text-lg">
                <span className="text-xl">{streamTypeIcon}</span>
                <span>Stream #{streamId}</span>
                <Badge 
                  variant={streamInfo.streamType as any}
                  className="capitalize"
                >
                  {streamInfo.streamType}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {streamInfo.description}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              {streamInfo.isActive ? (
                <div className="flex items-center space-x-1 text-green-500">
                  <Play className="h-4 w-4 fill-current" />
                  <span className="text-xs font-medium">Active</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-gray-500">
                  <Pause className="h-4 w-4" />
                  <span className="text-xs font-medium">Ended</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stream Participants */}
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-muted-foreground">From: </span>
              <span className="font-mono">{formatAddress(streamInfo.sender)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">To: </span>
              <span className="font-mono">{formatAddress(streamInfo.recipient)}</span>
            </div>
          </div>

          {/* Real-time Balance Display */}
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Available to Withdraw</span>
              {streamInfo.isActive && (
                <div className="flex items-center space-x-1 text-xs text-green-500">
                  <TrendingUp className="h-3 w-3" />
                  <span>Live</span>
                </div>
              )}
            </div>
            <div className="flex items-end space-x-2">
              <span className={`text-2xl font-bold text-green-600 ${streamInfo.isActive ? 'animate-pulse-balance' : ''}`}>
                {formatWeiToEther(displayBalance, 4)}
              </span>
              <span className="text-muted-foreground">STT</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Total Stream: {formatWeiToEther(streamInfo.totalAmount)} STT
            </div>
          </div>

          {/* Stream Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Duration: </span>
              <span>{formatDuration(Number(streamInfo.stopTime - streamInfo.startTime))}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Remaining: </span>
              <span>{formatTimeRemaining(Number(streamInfo.stopTime))}</span>
            </div>
          </div>

          {/* Flow Rate */}
          <div className="text-sm">
            <span className="text-muted-foreground">Flow Rate: </span>
            <span className="font-mono">
              {formatWeiToEther(streamInfo.flowRate * 3600n, 6)} STT/hour
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-1000 ${
                  streamInfo.isActive ? 'bg-gradient-to-r from-somnia-500 to-somnia-600' : 'bg-gray-400'
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-2 pt-2">
            {canWithdraw && (
              <Button
                onClick={handleWithdraw}
                disabled={isWithdrawing || withdrawableAmount <= 0n}
                className="flex-1"
                variant="somnia"
              >
                <Download className="h-4 w-4 mr-2" />
                {isWithdrawing ? 'Withdrawing...' : `Withdraw ${formatWeiToEther(withdrawableAmount, 4)} STT`}
              </Button>
            )}
            
            {canCancel && streamInfo.isActive && (
              <Button
                onClick={handleCancel}
                disabled={isCancelling}
                variant="destructive"
                size={canWithdraw ? "sm" : "default"}
                className={canWithdraw ? "" : "flex-1"}
              >
                <X className="h-4 w-4 mr-2" />
                {isCancelling ? 'Cancelling...' : 'Cancel'}
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href={`${NETWORK_CONFIG.BLOCK_EXPLORER}/tx/${streamId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
