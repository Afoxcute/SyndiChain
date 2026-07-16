import { useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/lib/contracts';
import { STREAM_PAY_ABI } from '@/lib/abis/StreamPay';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export type StreamInfo = {
  sender: string;
  recipient: string;
  totalAmount: bigint;
  flowRate: bigint;
  startTime: bigint;
  stopTime: bigint;
  currentBalance: bigint;
  isActive: boolean;
  streamType: string;
  description: string;
};

export function useStreamInfo(streamId: number | undefined) {
  const { data, isError, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.STREAM_PAY,
    abi: STREAM_PAY_ABI,
    functionName: 'getStreamInfo',
    args: streamId !== undefined ? [BigInt(streamId)] : undefined,
    query: {
      enabled: streamId !== undefined,
      refetchInterval: 2000, // Refetch every 2 seconds for real-time updates
    },
  });

  return {
    streamInfo: data ? {
      sender: data[0],
      recipient: data[1],
      totalAmount: data[2],
      flowRate: data[3],
      startTime: data[4],
      stopTime: data[5],
      currentBalance: data[6],
      isActive: data[7],
      streamType: data[8],
      description: data[9],
    } as StreamInfo : undefined,
    isLoading,
    isError,
    refetch,
  };
}

export function useUserStreams(userAddress: `0x${string}` | undefined) { // FIXED: Proper address type
  const { data: sentStreams } = useReadContract({
    address: CONTRACT_ADDRESSES.STREAM_PAY,
    abi: STREAM_PAY_ABI,
    functionName: 'getUserStreams',
    args: userAddress ? [userAddress] : undefined, // This will now be properly typed
    query: {
      enabled: !!userAddress,
      refetchInterval: 5000,
    },
  });

  const { data: receivedStreams } = useReadContract({
    address: CONTRACT_ADDRESSES.STREAM_PAY,
    abi: STREAM_PAY_ABI,
    functionName: 'getRecipientStreams',
    args: userAddress ? [userAddress] : undefined, // This will now be properly typed
    query: {
      enabled: !!userAddress,
      refetchInterval: 5000,
    },
  });

  return {
    sentStreams: sentStreams ? sentStreams.map(id => Number(id)) : [],
    receivedStreams: receivedStreams ? receivedStreams.map(id => Number(id)) : [],
  };
}

export function useProtocolStats() {
  const { data, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.STREAM_PAY,
    abi: STREAM_PAY_ABI,
    functionName: 'getProtocolStats',
    query: {
      refetchInterval: 10000, // Update every 10 seconds
    },
  });

  return {
    stats: data ? {
      totalStreams: Number(data[0]),
      totalUpdates: Number(data[1]),
      totalVolume: data[2],
      activeStreams: Number(data[3]),
      lastUpdate: Number(data[4]),
    } : undefined,
    isLoading,
  };
}

export function useActiveStreams() {
  const { data, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.STREAM_PAY,
    abi: STREAM_PAY_ABI,
    functionName: 'getActiveStreamIds',
    query: {
      refetchInterval: 5000,
    },
  });

  return {
    activeStreamIds: data ? data.map(id => Number(id)) : [],
    isLoading,
  };
}

export function useCreateStream() {
  const { writeContract, isPending, error } = useWriteContract();

  const createStream = async (
    recipient: `0x${string}`,
    duration: number,
    streamType: string,
    description: string,
    amount: bigint
  ) => {
    try {
      console.log('Creating stream with params:', {
        recipient,
        duration,
        streamType,
        description,
        amount: amount.toString(),
        contractAddress: CONTRACT_ADDRESSES.STREAM_PAY
      });

      // Validate inputs
      if (!CONTRACT_ADDRESSES.STREAM_PAY) {
        throw new Error('Contract address not configured');
      }
      
      if (amount <= 0n) {
        throw new Error('Amount must be greater than 0');
      }
      
      if (duration <= 0) {
        throw new Error('Duration must be greater than 0');
      }

      const hash = await writeContract({
        address: CONTRACT_ADDRESSES.STREAM_PAY,
        abi: STREAM_PAY_ABI,
        functionName: 'createStream',
        args: [recipient, BigInt(duration), streamType, description],
        value: amount,
      });
      
      toast.success('Stream created successfully!');
      return hash;
    } catch (err: any) {
      console.error('Create stream error:', err);
      
      // Better error messages
      if (err?.message?.includes('insufficient funds')) {
        toast.error('Insufficient funds to create stream');
      } else if (err?.message?.includes('user rejected')) {
        toast.error('Transaction cancelled by user');
      } else if (err?.message?.includes('gas')) {
        toast.error('Transaction failed - check gas settings');
      } else {
        toast.error(`Failed to create stream: ${err?.message || 'Unknown error'}`);
      }
      throw err;
    }
  };

  return {
    createStream,
    isPending,
    error,
  };
}


export function useWithdrawFromStream() {
  const { writeContract, isPending, error } = useWriteContract();

  const withdrawFromStream = async (streamId: number) => {
    try {
      const hash = await writeContract({
        address: CONTRACT_ADDRESSES.STREAM_PAY,
        abi: STREAM_PAY_ABI,
        functionName: 'withdrawFromStream',
        args: [BigInt(streamId)],
      });
      
      toast.success('Withdrawal successful!');
      return hash;
    } catch (err) {
      toast.error('Failed to withdraw from stream');
      throw err;
    }
  };

  return {
    withdrawFromStream,
    isPending,
    error,
  };
}

export function useCancelStream() {
  const { writeContract, isPending, error } = useWriteContract();

  const cancelStream = async (streamId: number) => {
    try {
      const hash = await writeContract({
        address: CONTRACT_ADDRESSES.STREAM_PAY,
        abi: STREAM_PAY_ABI,
        functionName: 'cancelStream',
        args: [BigInt(streamId)],
      });
      
      toast.success('Stream cancelled successfully!');
      return hash;
    } catch (err) {
      toast.error('Failed to cancel stream');
      throw err;
    }
  };

  return {
    cancelStream,
    isPending,
    error,
  };
}

// Hook for listening to real-time stream events
export function useStreamEvents() {
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.STREAM_PAY,
    abi: STREAM_PAY_ABI,
    eventName: 'StreamCreated',
    onLogs(logs) {
      logs.forEach(log => {
        setRecentEvents(prev => [
          { type: 'StreamCreated', ...log, timestamp: Date.now() },
          ...prev.slice(0, 9) // Keep only last 10 events
        ]);
        toast.success(`New stream created: #${log.args.streamId}`);
      });
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.STREAM_PAY,
    abi: STREAM_PAY_ABI,
    eventName: 'Withdrawn',
    onLogs(logs) {
      logs.forEach(log => {
        setRecentEvents(prev => [
          { type: 'Withdrawn', ...log, timestamp: Date.now() },
          ...prev.slice(0, 9)
        ]);
      });
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.STREAM_PAY,
    abi: STREAM_PAY_ABI,
    eventName: 'StreamCancelled',
    onLogs(logs) {
      logs.forEach(log => {
        setRecentEvents(prev => [
          { type: 'StreamCancelled', ...log, timestamp: Date.now() },
          ...prev.slice(0, 9)
        ]);
      });
    },
  });

  return { recentEvents };
}

// Hook for real-time balance updates
export function useRealTimeBalance(streamId: number | undefined) {
  const { data: contractBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.STREAM_PAY,
    abi: STREAM_PAY_ABI,
    functionName: 'getCurrentBalance',
    args: streamId !== undefined ? [BigInt(streamId)] : undefined,
    query: {
      enabled: streamId !== undefined,
      refetchInterval: 1000,
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
  });

  return {
    balance: contractBalance || 0n,
    refetchBalance,
  };
}
