'use client';

import { useState, useEffect } from 'react'; 
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateStream } from '@/hooks/useStreamContract';
import { RATE_HELPERS, STREAM_TYPES, StreamType } from '@/lib/contracts';
import { formatWeiToEther, formatDuration } from '@/lib/utils';
import { Calculator, Clock, DollarSign, User, FileText, AlertCircle, CheckCircle, ShieldAlert, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { detectCreationFraud, FraudCheckResult } from '@/lib/stream-fraud-detector';
import { useAccount } from 'wagmi';

interface CreateStreamFormProps {
  initialValues?: {
    recipient: string;
    amount: string;
    duration: number;
    durationUnit: 'seconds' | 'minutes' | 'hours' | 'days';
    streamType?: string;
    description?: string;
  } | null;
}

export default function CreateStreamForm({ initialValues }: CreateStreamFormProps) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('');
  const [streamType, setStreamType] = useState<StreamType>('work');
  const [description, setDescription] = useState('');
  const [usdRate, setUsdRate] = useState('');
  
  const [isCheckingFraud, setIsCheckingFraud] = useState(false);
  const [fraudResult, setFraudResult] = useState<FraudCheckResult | null>(null);
  const [showFraudModal, setShowFraudModal] = useState(false);
  
  const { createStream, isPending } = useCreateStream();
  const { address } = useAccount();

  useEffect(() => {
    if (initialValues) {
      const durationInHours = 
        initialValues.durationUnit === 'days' ? initialValues.duration * 24 :
        initialValues.durationUnit === 'hours' ? initialValues.duration :
        initialValues.durationUnit === 'minutes' ? initialValues.duration / 60 :
        initialValues.duration / 3600;
      
      setRecipient(initialValues.recipient);
      setAmount(initialValues.amount);
      setDuration(durationInHours.toString());
      if (initialValues.streamType) setStreamType(initialValues.streamType as StreamType);
      if (initialValues.description) setDescription(initialValues.description);
    }
  }, [initialValues]);

  const durationSeconds = duration ? parseInt(duration) * 3600 : 0;
  const amountWei = amount ? RATE_HELPERS.parseToWei(amount) : 0n;
  const flowRateWei = durationSeconds > 0 ? amountWei / BigInt(durationSeconds) : 0n;
  const flowRateUsd = flowRateWei > 0 ? RATE_HELPERS.weiSecondToUsdHour(flowRateWei) : 0;

  const handleUsdRateChange = (value: string) => {
    setUsdRate(value);
    if (value && duration) {
      const usdPerHour = parseFloat(value);
      const hours = parseFloat(duration);
      const totalUsd = usdPerHour * hours;
      const totalEth = totalUsd / 2000;
      setAmount(totalEth.toString());
    }
  };

  const handleCheckFraud = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recipient || !amount || !duration || !description) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setIsCheckingFraud(true);
    try {
      const result = await detectCreationFraud({
        recipient: recipient as `0x${string}`,
        amount: amount,
        duration: durationSeconds,
        senderAddress: address || '',
      });
      
      setFraudResult(result);
      setShowFraudModal(true);

      if (result.recommendation === 'block') {
        toast.error(`🚨 Stream blocked: ${result.message}`);
      } else if (result.recommendation === 'warn') {
        toast.loading(`⚠️ ${result.message}`, { duration: 4000 });
      }
    } catch (error) {
      console.error('Fraud check failed:', error);
      toast.error('Fraud detection failed. Proceeding with caution.');
      await handleSubmit();
    } finally {
      setIsCheckingFraud(false);
    }
  };

  const handleFraudConfirm = async (proceed: boolean) => {
    setShowFraudModal(false);
    toast.dismiss();
    
    if (!proceed) {
      toast.error('Stream creation cancelled');
      return;
    }
    
    if (fraudResult?.recommendation === 'block') {
      toast.error('This stream cannot be created due to fraud detection');
      return;
    }
    
    await handleSubmit();
  };

  const handleSubmit = async () => {
    if (!recipient || !amount || !duration || !description) {
      return;
    }
    try {
      await createStream(
        recipient as `0x${string}`,
        durationSeconds,
        streamType,
        description,
        amountWei
      );
      
      setRecipient('');
      setAmount('');
      setDuration('');
      setDescription('');
      setUsdRate('');
      setFraudResult(null);
    } catch (error) {
      console.error('Failed to create stream:', error);
    }
  };

  const getFraudColor = (score: number) => {
    if (score < 30) return 'text-green-500';
    if (score < 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-6 w-6 text-somnia-500" />
            <span>Create New Stream</span>
          </CardTitle>
          <CardDescription>
            Set up a real-time payment stream with per-second money flow. AI-powered fraud detection enabled.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleCheckFraud} className="space-y-6">
            {/* Stream Type Selection */}
            <div className="space-y-2">
              <Label>Stream Type</Label>
              <div className="flex space-x-2">
                {Object.entries(STREAM_TYPES).map(([key, config]) => (
                  <Button
                    key={key}
                    type="button"
                    variant={streamType === key ? "somnia" : "outline"}
                    onClick={() => setStreamType(key as StreamType)}
                    className="flex items-center space-x-2"
                  >
                    <span>{config.icon}</span>
                    <span>{config.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Recipient Address */}
            <div className="space-y-2">
              <Label htmlFor="recipient" className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Recipient Address</span>
              </Label>
              <Input
                id="recipient"
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Duration (hours)</span>
              </Label>
              <Input
                id="duration"
                type="number"
                placeholder="24"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
                min="0.01"
                step="0.01"
              />
              {duration && (
                <p className="text-xs text-muted-foreground">
                  {formatDuration(durationSeconds)}
                </p>
              )}
            </div>

            {/* USD Rate (Helper) */}
            <div className="space-y-2">
              <Label htmlFor="usdRate" className="flex items-center space-x-2">
                <Calculator className="h-4 w-4" />
                <span>USD Rate per Hour (Optional)</span>
              </Label>
              <Input
                id="usdRate"
                type="number"
                placeholder="25.00"
                value={usdRate}
                onChange={(e) => handleUsdRateChange(e.target.value)}
                min="0"
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                Enter USD/hour to auto-calculate total amount
              </p>
            </div>

            {/* Total Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4" />
                <span>Total Amount (STT)</span>
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min="0"
                step="0.000001"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Description</span>
              </Label>
              <Input
                id="description"
                placeholder="e.g., Frontend development work"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Summary Card */}
            {amount && duration && (
              <Card className="bg-somnia-50 dark:bg-somnia-950/20 border-somnia-200 dark:border-somnia-800">
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-3 text-somnia-700 dark:text-somnia-300">
                    Stream Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Amount:</span>
                      <div className="font-mono font-semibold">{amount} STT</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <div className="font-semibold">{formatDuration(durationSeconds)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Flow Rate:</span>
                      <div className="font-mono text-xs">
                        {formatWeiToEther(flowRateWei * 3600n, 6)} STT/hour
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">USD Rate:</span>
                      <div className="font-semibold">
                        ${flowRateUsd.toFixed(2)}/hour
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isPending || isCheckingFraud || !recipient || !amount || !duration || !description}
              className="w-full"
              variant="somnia"
              size="lg"
            >
              {isCheckingFraud ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking AI Fraud Detection...
                </>
              ) : (
                'Review & Create Stream'
              )}
            </Button>
          </form>

          {/* ✅ FIXED: Fraud Modal with Null Safety */}
          {showFraudModal && fraudResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            >
              <Card className="max-w-md w-full">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    {fraudResult.recommendation === 'proceed' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : fraudResult.recommendation === 'warn' ? (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <ShieldAlert className="h-5 w-5 text-red-500" />
                    )}
                    <span>
                      {fraudResult.recommendation === 'proceed' && 'Stream Safe'}
                      {fraudResult.recommendation === 'warn' && 'Stream Warning'}
                      {fraudResult.recommendation === 'block' && 'Stream Blocked'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold mb-2">Risk Score</p>
                    <div className={`text-3xl font-bold ${getFraudColor(fraudResult.riskScore)}`}>
                      {fraudResult.riskScore}/100
                    </div>
                  </div>

                  {/* ✅ FIXED: Added null safety check */}
                  {fraudResult?.riskFactors && fraudResult.riskFactors.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold mb-2">Risk Factors</p>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        {fraudResult.riskFactors.map((factor, i) => (
                          <li key={i} className="text-muted-foreground">{factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-muted p-3 rounded text-sm">
                    <p className="font-medium mb-1">🤖 AI Analysis:</p>
                    <p className="text-muted-foreground">{fraudResult.message || 'No analysis available'}</p>
                  </div>

                  <div className="flex space-x-2">
                    {fraudResult.recommendation !== 'block' ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => handleFraudConfirm(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleFraudConfirm(true)}
                          className="flex-1"
                          variant="somnia"
                          disabled={isPending}
                        >
                          {isPending ? "Creating..." : "Proceed Anyway"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => setShowFraudModal(false)}
                        className="w-full"
                        variant="outline"
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
