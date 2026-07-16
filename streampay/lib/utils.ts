import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) {
    return `${days}d ${hours}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

export function formatTimeRemaining(endTime: number): string {
  const now = Math.floor(Date.now() / 1000)
  const remaining = endTime - now
  
  if (remaining <= 0) {
    return "Completed"
  }
  
  return formatDuration(remaining)
}

export function formatWeiToEther(wei: bigint, decimals: number = 6): string {
  const ether = Number(wei) / 1e18
  return ether.toFixed(decimals)
}

export function formatUsdRate(weiPerSecond: bigint): string {
  const ethPerHour = (Number(weiPerSecond) * 3600) / 1e18
  const usdPerHour = ethPerHour * 2000 // Assuming $2000 per ETH
  return `$${usdPerHour.toFixed(2)}/hour`
}

export function calculateProgress(startTime: number, endTime: number): number {
  const now = Math.floor(Date.now() / 1000)
  const total = endTime - startTime
  const elapsed = now - startTime
  
  if (elapsed <= 0) return 0
  if (elapsed >= total) return 100
  
  return (elapsed / total) * 100
}

export function getStreamTypeColor(streamType: string): string {
  switch (streamType.toLowerCase()) {
    case 'work':
      return 'text-green-500'
    case 'subscription':
      return 'text-purple-500'
    case 'gaming':
      return 'text-yellow-500'
    default:
      return 'text-blue-500'
  }
}

export function getStreamTypeIcon(streamType: string): string {
  switch (streamType.toLowerCase()) {
    case 'work':
      return '💼'
    case 'subscription':
      return '📱'
    case 'gaming':
      return '🎮'
    default:
      return '💫'
  }
}
