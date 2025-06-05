import React, { useState, FormEvent, ChangeEvent } from 'react';
import useStellar from '../hooks/useStellar';

interface CreateChallengeProps {
  onChallengeCreated?: (challengeId: string) => void;
}

interface FormDataState {
  name: string;
  targetAmount: string;
  weeklyAmount: string;
  durationDays: string;
  rewardPercentage: string;
  vaultAddress: string;
  rewardToken: string;
}

const CreateChallenge: React.FC<CreateChallengeProps> = ({ onChallengeCreated }) => {
  const { createSavingsChallenge, isLoading, error, connectWallet } = useStellar();
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  const [publicKey, setPublicKey] = useState<string>('');
  
  const [formData, setFormData] = useState<FormDataState>({
    name: '',
    targetAmount: '',
    weeklyAmount: '',
    durationDays: '',
    rewardPercentage: '',
    vaultAddress: '',
    rewardToken: '',
  });
  
  const handleConnectWallet = async (): Promise<void> => {
    try {
      const address = await connectWallet();
      setPublicKey(address);
      setWalletConnected(true);
    } catch (err) {
      console.error('Error connecting wallet:', err);
      alert('Failed to connect wallet. Please make sure the Freighter extension is installed and unlocked.');
    }
  };
  
  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!walletConnected) {
      alert('Please connect your wallet first');
      return;
    }
    
    // Convert inputs to expected formats
    const name = formData.name.trim();
    const targetAmount = parseFloat(formData.targetAmount);
    const weeklyAmount = parseFloat(formData.weeklyAmount);
    const durationDays = parseInt(formData.durationDays, 10);
    // Convert percentage to basis points (e.g., 5% -> 500)
    const rewardPercentage = Math.round(parseFloat(formData.rewardPercentage) * 100);
    
    if (isNaN(targetAmount) || isNaN(weeklyAmount) || isNaN(durationDays) || isNaN(rewardPercentage)) {
      alert('Please enter valid numbers for amount, duration, and reward');
      return;
    }
    
    try {
      const result = await createSavingsChallenge({
        creator: publicKey,
        name,
        goalAmount: targetAmount,
        weeklyAmount,
        // For a proper implementation, you might want to convert days to weeks
        durationWeeks: Math.ceil(durationDays / 7),
        rewardPercentage,
        vaultAddress: formData.vaultAddress || null,
        rewardToken: formData.rewardToken || null
      });
      
      if (result && result.challengeId && onChallengeCreated) {
        onChallengeCreated(result.challengeId);
        
        // Reset form
        setFormData({
          name: '',
          targetAmount: '',
          weeklyAmount: '',
          durationDays: '',
          rewardPercentage: '',
          vaultAddress: '',
          rewardToken: '',
        });

        alert(`Challenge created successfully! Challenge ID: ${result.challengeId}`);
      }
    } catch (err) {
      console.error('Error creating challenge:', err);
      alert('Failed to create challenge. Please check the console for details.');
    }
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-4">
      <h2 className="text-xl font-bold mb-4">Create New Savings Challenge</h2>
      
      {!walletConnected ? (
        <div className="mb-4">
          <p className="text-gray-600 mb-4">
            Connect your wallet to create a new savings challenge.
          </p>
          <button
            onClick={handleConnectWallet}
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 w-full"
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-sm text-gray-500">Connected as: {publicKey}</p>
          </div>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="name">
                Challenge Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                required
                placeholder="e.g., Vacation Fund"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="targetAmount">
                Target Amount (XLM)
              </label>
              <input
                id="targetAmount"
                name="targetAmount"
                type="number"
                value={formData.targetAmount}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                required
                min="0"
                step="0.0000001"
                placeholder="e.g., 1000"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="weeklyAmount">
                Weekly Target (XLM)
              </label>
              <input
                id="weeklyAmount"
                name="weeklyAmount"
                type="number"
                value={formData.weeklyAmount}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                required
                min="0"
                step="0.0000001"
                placeholder="e.g., 50"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="durationDays">
                Duration (Days)
              </label>
              <input
                id="durationDays"
                name="durationDays"
                type="number"
                value={formData.durationDays}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                required
                min="1"
                placeholder="e.g., 90"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="rewardPercentage">
                Reward Percentage (%)
              </label>
              <input
                id="rewardPercentage"
                name="rewardPercentage"
                type="number"
                value={formData.rewardPercentage}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                required
                min="0"
                max="100"
                step="0.01"
                placeholder="e.g., 5"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="vaultAddress">
                Vault Contract Address (Optional)
              </label>
              <input
                id="vaultAddress"
                name="vaultAddress"
                type="text"
                value={formData.vaultAddress}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="Contract ID"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-700 mb-2" htmlFor="rewardToken">
                Reward Token Contract Address (Optional)
              </label>
              <input
                id="rewardToken"
                name="rewardToken"
                type="text"
                value={formData.rewardToken}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
                placeholder="Contract ID"
              />
            </div>
            
            <button
              type="submit"
              className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-blue-300 w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Challenge'}
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default CreateChallenge;
