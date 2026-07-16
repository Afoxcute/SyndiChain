'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useActiveTemplates, useTemplate, useCreateStreamFromTemplate, useFactoryStats, useCreateTemplate } from '@/hooks/useTemplates';
import { STREAM_TYPES, RATE_HELPERS } from '@/lib/contracts';
import { formatWeiToEther, formatDuration, getStreamTypeIcon } from '@/lib/utils';
import { 
  Search, 
  Filter, 
  Star, 
  Users, 
  Clock,
  DollarSign,
  Zap,
  Plus,
  TrendingUp
} from 'lucide-react';
import { useAccount } from 'wagmi';
import toast from 'react-hot-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

function TemplateCard({ templateId }: { templateId: number }) {
  const { template, isLoading } = useTemplate(templateId);
  const { createStreamFromTemplate, isPending } = useCreateStreamFromTemplate();
  const { address } = useAccount();
  
  const [showUseForm, setShowUseForm] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [duration, setDuration] = useState('');
  const [customRateUsd, setCustomRateUsd] = useState('');

  if (isLoading || !template) {
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
          </div>
        </CardContent>
      </Card>
    );
  }

  const usdRate = RATE_HELPERS.weiSecondToUsdHour(template.suggestedRate);
  const minDurationHours = Number(template.minDuration) / 3600;
  const maxDurationHours = Number(template.maxDuration) / 3600;

  const handleUseTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recipient || !duration) {
      toast.error('Please fill in all required fields');
      return;
    }

    const durationHours = parseFloat(duration);
    const customRate = customRateUsd ? parseFloat(customRateUsd) : undefined;

    try {
      await createStreamFromTemplate(
        templateId,
        recipient as `0x${string}`,
        durationHours,
        customRate
      );
      
      setShowUseForm(false);
      setRecipient('');
      setDuration('');
      setCustomRateUsd('');
    } catch (error) {
      console.error('Failed to create stream from template:', error);
    }
  };

  return (
    <motion.div variants={itemVariants}>
      <Card className="transition-all duration-300 hover:shadow-lg hover:shadow-somnia-500/10">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{getStreamTypeIcon(template.streamType)}</span>
              <div>
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <CardDescription className="mt-1">
                  {template.description}
                </CardDescription>
              </div>
            </div>
            <Badge variant={template.streamType as any} className="capitalize">
              {template.streamType}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Template Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">${Math.max(1, usdRate).toFixed(2)}/hour</p>
                <p className="text-xs text-muted-foreground">Suggested rate</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{Number(template.usageCount)}</p>
                <p className="text-xs text-muted-foreground">Times used</p>
              </div>
            </div>
          </div>

          {/* Duration Range */}
          <div className="text-sm">
            <div className="flex items-center space-x-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Duration Range</span>
            </div>
            <p className="text-muted-foreground">
              {formatDuration(Number(template.minDuration))} - {formatDuration(Number(template.maxDuration))}
            </p>
          </div>

          {/* Use Template Form */}
          {showUseForm ? (
            <form onSubmit={handleUseTemplate} className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor={`recipient-${templateId}`}>Recipient Address</Label>
                <Input
                  id={`recipient-${templateId}`}
                  placeholder="0x..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`duration-${templateId}`}>Duration (hours)</Label>
                <Input
                  id={`duration-${templateId}`}
                  type="number"
                  placeholder={`${minDurationHours}-${maxDurationHours}`}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min={minDurationHours}
                  max={maxDurationHours}
                  step="0.1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`rate-${templateId}`}>Custom Rate (USD/hour, optional)</Label>
                <Input
                  id={`rate-${templateId}`}
                  type="number"
                  placeholder={`Default: $${Math.max(1, usdRate).toFixed(2)}/hour`}
                  value={customRateUsd}
                  onChange={(e) => setCustomRateUsd(e.target.value)}
                  step="0.01"
                  min="0.01"
                />
              </div>

              <div className="flex space-x-2">
                <Button
                  type="submit"
                  disabled={isPending || !address}
                  variant="somnia"
                  className="flex-1"
                >
                  {isPending ? 'Creating...' : 'Create Stream'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowUseForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button
              onClick={() => setShowUseForm(true)}
              disabled={!address}
              variant="somnia"
              className="w-full"
            >
              <Zap className="h-4 w-4 mr-2" />
              Use Template
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Template Creation Modal Component
function CreateTemplateModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [streamType, setStreamType] = useState('work');
  const [hourlyRateUsd, setHourlyRateUsd] = useState('');
  const [minHours, setMinHours] = useState('1');
  const [maxHours, setMaxHours] = useState('40');
  const [description, setDescription] = useState('');

  const { createTemplate, isPending } = useCreateTemplate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createTemplate(
        name,
        streamType,
        parseFloat(hourlyRateUsd),
        parseFloat(minHours),
        parseFloat(maxHours),
        description
      );
      
      onClose();
      // Reset form
      setName('');
      setHourlyRateUsd('');
      setMinHours('1');
      setMaxHours('40');
      setDescription('');
    } catch (error) {
      console.error('Template creation failed:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Create New Template</CardTitle>
          <CardDescription>Create a reusable stream template</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g., Senior React Developer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <Label>Stream Type</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(STREAM_TYPES).map(([key, config]) => (
                  <Button
                    key={key}
                    type="button"
                    variant={streamType === key ? "somnia" : "outline"}
                    onClick={() => setStreamType(key)}
                    size="sm"
                  >
                    <span className="mr-1">{config.icon}</span>
                    {config.name}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="hourly-rate">Hourly Rate (USD)</Label>
              <Input
                id="hourly-rate"
                type="number"
                placeholder="25"
                value={hourlyRateUsd}
                onChange={(e) => setHourlyRateUsd(e.target.value)}
                required
                min="1"
                step="0.01"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="min-hours">Min Hours</Label>
                <Input
                  id="min-hours"
                  type="number"
                  value={minHours}
                  onChange={(e) => setMinHours(e.target.value)}
                  required
                  min="1"
                />
              </div>
              <div>
                <Label htmlFor="max-hours">Max Hours</Label>
                <Input
                  id="max-hours"
                  type="number"
                  value={maxHours}
                  onChange={(e) => setMaxHours(e.target.value)}
                  required
                  min="1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Detailed description of the service"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="flex space-x-2">
              <Button type="submit" disabled={isPending} variant="somnia" className="flex-1">
                {isPending ? 'Creating...' : 'Create Template'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TemplatesPage() {
  const { address } = useAccount();
  const { activeTemplateIds, isLoading } = useActiveTemplates();
  const { stats } = useFactoryStats();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter templates based on search and type
  const filteredTemplateIds = activeTemplateIds;

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-somnia-500 to-somnia-700 bg-clip-text text-transparent">
            Stream Templates
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Browse pre-made templates for common streaming use cases. Create streams instantly with predefined rates and durations.
          </p>
        </motion.div>

        {/* Stats */}
        {stats && (
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.templatesCreated}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Streams Created</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.streamsFromTemplates}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Work Streams</CardTitle>
                <span className="text-lg">💼</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.workStreams}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gaming Streams</CardTitle>
                <span className="text-lg">🎮</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.gamingStreams}</div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Filters */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col space-y-4">
                {/* Search Bar */}
                <div className="flex-1">
                  <Label htmlFor="search">Search Templates</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by name or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Stream Type Filter */}
                <div>
                  <Label>Stream Type</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button
                      variant={selectedType === 'all' ? 'somnia' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedType('all')}
                    >
                      All
                    </Button>
                    {Object.entries(STREAM_TYPES).map(([key, config]) => (
                      <Button
                        key={key}
                        variant={selectedType === key ? 'somnia' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedType(key)}
                        className="flex items-center space-x-1"
                      >
                        <span>{config.icon}</span>
                        <span className="hidden sm:inline">{config.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-4 bg-muted rounded"></div>
                    <div className="h-4 bg-muted rounded w-2/3"></div>
                    <div className="h-10 bg-muted rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTemplateIds.length > 0 ? (
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredTemplateIds.map((templateId) => (
              <TemplateCard key={templateId} templateId={templateId} />
            ))}
          </motion.div>
        ) : (
          <motion.div variants={itemVariants}>
            <Card>
              <CardContent className="text-center py-12">
                <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No templates found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || selectedType !== 'all' 
                    ? 'Try adjusting your search or filters'
                    : 'No templates available yet'
                  }
                </p>
                {!address && (
                  <p className="text-sm text-muted-foreground">
                    Connect your wallet to see available templates
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Create Template CTA */}
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-r from-somnia-50 to-purple-50 dark:from-somnia-950/20 dark:to-purple-950/20 border-somnia-200 dark:border-somnia-800">
            <CardContent className="text-center py-8">
              <Plus className="h-12 w-12 mx-auto mb-4 text-somnia-500" />
              <h3 className="text-lg font-semibold mb-2">Create Your Own Template</h3>
              <p className="text-muted-foreground mb-4">
                Have a common use case? Create a template for others to use
              </p>
              <Button 
                variant="somnia" 
                disabled={!address}
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Create Template Modal */}
      {showCreateModal && (
        <CreateTemplateModal onClose={() => setShowCreateModal(false)} />
      )}
    </>
  );
}
