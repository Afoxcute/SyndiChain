import { useReadContract, useWriteContract } from 'wagmi';
import { CONTRACT_ADDRESSES, RATE_HELPERS } from '@/lib/contracts';
import { STREAM_FACTORY_ABI } from '@/lib/abis/StreamFactory';
import { parseEther } from 'viem';
import toast from 'react-hot-toast';

export type Template = {
  name: string;
  streamType: string;
  suggestedRate: bigint;
  minDuration: bigint;
  maxDuration: bigint;
  description: string;
  isActive: boolean;
  creator: string;
  usageCount: bigint;
};

export function useTemplate(templateId: number | undefined) {
  const { data, isLoading, error } = useReadContract({
    address: CONTRACT_ADDRESSES.STREAM_FACTORY,
    abi: STREAM_FACTORY_ABI,
    functionName: 'getTemplate',
    args: templateId !== undefined ? [BigInt(templateId)] : undefined,
    query: {
      enabled: templateId !== undefined,
    },
  });

  return {
    template: data ? {
      name: data[0],
      streamType: data[1],
      suggestedRate: data[2],
      minDuration: data[3],
      maxDuration: data[4],
      description: data[5],
      isActive: data[6],
      creator: data[7],
      usageCount: data[8],
    } as Template : undefined,
    isLoading,
    error,
  };
}

export function useTemplatesByType(streamType: string) {
  const { data, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.STREAM_FACTORY,
    abi: STREAM_FACTORY_ABI,
    functionName: 'getTemplatesByType',
    args: [streamType],
    query: {
      refetchInterval: 30000,
    },
  });

  return {
    templateIds: data ? data.map(id => Number(id)) : [],
    isLoading,
  };
}

export function useActiveTemplates() {
  const { data, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.STREAM_FACTORY,
    abi: STREAM_FACTORY_ABI,
    functionName: 'getActiveTemplateIds',
    query: {
      refetchInterval: 30000,
    },
  });

  return {
    activeTemplateIds: data ? data.map(id => Number(id)) : [],
    isLoading,
  };
}

export function useFactoryStats() {
  const { data, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.STREAM_FACTORY,
    abi: STREAM_FACTORY_ABI,
    functionName: 'getFactoryStats',
    query: {
      refetchInterval: 30000,
    },
  });

  return {
    stats: data ? {
      templatesCreated: Number(data[0]),
      streamsFromTemplates: Number(data[1]),
      totalPresets: Number(data[2]),
      workStreams: Number(data[3]),
      subscriptionStreams: Number(data[4]),
      gamingStreams: Number(data[5]),
    } : undefined,
    isLoading,
  };
}

// FIXED: Simplified createTemplate with USD rate conversion
export function useCreateTemplate() {
  const { writeContract, isPending, error } = useWriteContract();

  const createTemplate = async (
    name: string,
    streamType: string,
    hourlyRateUsd: number,        // USD per hour (e.g., 25)
    minDurationHours: number,     // Hours (e.g., 1)
    maxDurationHours: number,     // Hours (e.g., 40)
    description: string
  ) => {
    try {
      // Convert USD rate to wei per second
      const rateWeiPerSecond = RATE_HELPERS.usdHourToWeiSecond(hourlyRateUsd);
      const minDurationSeconds = BigInt(minDurationHours * 3600);
      const maxDurationSeconds = BigInt(maxDurationHours * 3600);

      const hash = await writeContract({
        address: CONTRACT_ADDRESSES.STREAM_FACTORY,
        abi: STREAM_FACTORY_ABI,
        functionName: 'createTemplate',
        args: [
          name, 
          streamType, 
          rateWeiPerSecond, 
          minDurationSeconds, 
          maxDurationSeconds, 
          description
        ],
        value: parseEther("0.001"), // Small creation fee
      });
      
      toast.success('Template created successfully!');
      return hash;
    } catch (err) {
      console.error('Create template error:', err);
      toast.error('Failed to create template');
      throw err;
    }
  };

  return {
    createTemplate,
    isPending,
    error,
  };
}

export function useCreateStreamFromTemplate() {
  const { writeContract, isPending, error } = useWriteContract();

  const createStreamFromTemplate = async (
    templateId: number,
    recipient: `0x${string}`,
    durationHours: number,        // FIXED: Accept hours, convert internally
    customRateUsd?: number        // FIXED: Optional USD rate
  ) => {
    try {
      const durationSeconds = Math.floor(durationHours * 3600);
      
      // If custom rate provided, use it; otherwise use 0n (template default)
      const customRateWei = customRateUsd 
        ? RATE_HELPERS.usdHourToWeiSecond(customRateUsd)
        : 0n;

      // Calculate payment amount (template will handle rate calculation)
      const estimatedRate = customRateWei || parseEther("0.01"); // Fallback estimate
      const totalPayment = BigInt(durationSeconds) * estimatedRate;

      const hash = await writeContract({
        address: CONTRACT_ADDRESSES.STREAM_FACTORY,
        abi: STREAM_FACTORY_ABI,
        functionName: 'createStreamFromTemplate',
        args: [BigInt(templateId), recipient, BigInt(durationSeconds), customRateWei],
        value: totalPayment,
      });
      
      toast.success('Stream created from template!');
      return hash;
    } catch (err) {
      console.error('Create stream from template error:', err);
      toast.error('Failed to create stream from template');
      throw err;
    }
  };

  return {
    createStreamFromTemplate,
    isPending,
    error,
  };
}
