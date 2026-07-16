'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProtocolStats, useActiveStreams } from '@/hooks/useStreamContract';
import { useFactoryStats } from '@/hooks/useTemplates';
import { formatWeiToEther } from '@/lib/utils';
import { 
  Activity, 
  TrendingUp, 
  Users, 
  Clock,
  BarChart3,
  Zap,
  DollarSign,
  Target
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

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

// Mock data for charts (in real app, this would come from your backend)
const streamActivityData = [
  { name: 'Jan', streams: 12, volume: 45.2 },
  { name: 'Feb', streams: 19, volume: 78.1 },
  { name: 'Mar', streams: 25, volume: 102.3 },
  { name: 'Apr', streams: 18, volume: 89.7 },
  { name: 'May', streams: 32, volume: 134.5 },
  { name: 'Jun', streams: 28, volume: 116.8 },
];

const streamTypeData = [
  { name: 'Work', value: 65, color: '#10b981' },
  { name: 'Subscription', value: 25, color: '#8b5cf6' },
  { name: 'Gaming', value: 10, color: '#f59e0b' },
];

const performanceData = [
  { name: 'Updates/Hour', value: 3600 },
  { name: 'Avg Response', value: 0.2 },
  { name: 'Success Rate', value: 99.8 },
  { name: 'Gas Efficiency', value: 85 },
];

export default function AnalyticsPage() {
  const { stats: protocolStats, isLoading: protocolLoading } = useProtocolStats();
  const { stats: factoryStats, isLoading: factoryLoading } = useFactoryStats();
  const { activeStreamIds } = useActiveStreams();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-somnia-500 to-somnia-700 bg-clip-text text-transparent">
          Analytics Dashboard
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Real-time insights into StreamPay protocol performance, usage patterns, and network statistics.
        </p>
      </motion.div>

      {/* Key Metrics */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {protocolStats?.totalVolume ? `${formatWeiToEther(protocolStats.totalVolume, 1)}` : '0'} STT
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +12.5% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Streams</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {protocolStats?.activeStreams || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time streaming
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Updates</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {protocolStats?.totalUpdates?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Balance updates performed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates Used</CardTitle>
            <Target className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {factoryStats?.streamsFromTemplates || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Streams from templates
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Stream Activity Chart */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Stream Activity</span>
              </CardTitle>
              <CardDescription>
                Monthly stream creation and volume trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={streamActivityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="streams" 
                      stroke="#0ea5e9" 
                      strokeWidth={2}
                      name="Streams Created"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="volume" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Volume (STT)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stream Types Distribution */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Stream Types</span>
              </CardTitle>
              <CardDescription>
                Distribution of stream types across the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={streamTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {streamTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="flex justify-center space-x-4 mt-4">
                {streamTypeData.map((item) => (
                  <div key={item.name} className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Performance Metrics */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Network Performance</span>
            </CardTitle>
            <CardDescription>
              Real-time protocol performance and efficiency metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Protocol Status */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Protocol Status</span>
            </CardTitle>
            <CardDescription>
              Current protocol health and operational metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Protocol Status</p>
                  <p className="text-2xl font-bold text-green-600">Operational</p>
                </div>
                <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Last Update</p>
                  <p className="text-lg font-bold text-blue-600">
                    {protocolStats?.lastUpdate ? 
                      new Date(protocolStats.lastUpdate * 1000).toLocaleTimeString() : 
                      'Unknown'
                    }
                  </p>
                </div>
                <Clock className="h-6 w-6 text-blue-500" />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Network Load</p>
                  <p className="text-2xl font-bold text-purple-600">Low</p>
                </div>
                <BarChart3 className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
