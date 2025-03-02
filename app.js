class WalAirdropExplorer {
    constructor() {
        console.log('WalAirdropExplorer constructor called');
        this.apiUrl = 'https://fullnode.mainnet.sui.io:443';
        
        // Default to WALAirdrop
        this.currentFilter = {
            type: 'struct',
            value: '0x98af8b8fde88f3c4bdf0fcedcf9afee7d10f66d480b74fb5a3a2e23dc7f5a564::airdrop::WALAirdrop'
        };
    }

    setFilter(contractAddress) {
        this.currentFilter = {
            type: 'struct',
            value: contractAddress
        };
    }

    getQueryFilter() {
        return {
            MatchAll: [{
                StructType: '0x98af8b8fde88f3c4bdf0fcedcf9afee7d10f66d480b74fb5a3a2e23dc7f5a564::airdrop::WALAirdrop'
            }]
        };
    }

    initialize() {
        console.log('WalAirdropExplorer initialize called');
        this.transactionContainer = document.getElementById('transactionDetails');
        this.loadingSpinner = document.querySelector('.loading-spinner');
        this.searchInput = document.getElementById('searchInput');
        this.searchButton = document.getElementById('searchButton');
        this.clearButton = document.getElementById('clearButton');
        this.objectTypeSelect = document.getElementById('objectTypeSelect');
        this.customInputContainer = document.getElementById('customInputContainer');
        this.customObjectInput = document.getElementById('customObjectInput');
        
        if (!this.transactionContainer || !this.loadingSpinner || !this.searchInput || 
            !this.searchButton || !this.clearButton || !this.objectTypeSelect || 
            !this.customInputContainer || !this.customObjectInput) {
            console.error('Could not find required DOM elements');
            return;
        }

        // Object type selection handling
        this.objectTypeSelect.addEventListener('change', () => {
            const selectedValue = this.objectTypeSelect.value;
            this.customInputContainer.classList.toggle('hidden', selectedValue !== 'custom');
            
            if (selectedValue === 'walairdrop') {
                this.setFilter('0x98af8b8fde88f3c4bdf0fcedcf9afee7d10f66d480b74fb5a3a2e23dc7f5a564::airdrop::WALAirdrop');
            } else if (selectedValue === 'sui') {
                this.setFilter('0x2::coin::Coin<0x2::sui::SUI>');
            }
        });

        // Custom contract input handling
        this.customObjectInput.addEventListener('input', () => {
            const value = this.customObjectInput.value.trim();
            if (value) {
                this.setFilter(value);
            }
        });

        // Add event listeners for search
        this.searchButton.addEventListener('click', () => this.handleSearch());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });

        // Clear button functionality
        this.clearButton.addEventListener('click', () => {
            this.searchInput.value = '';
            this.clearButton.classList.add('hidden');
            this.searchInput.focus();
        });

        // Show/hide clear button based on input content
        this.searchInput.addEventListener('input', () => {
            this.clearButton.classList.toggle('hidden', !this.searchInput.value);
        });

        // Add input animation
        this.searchInput.addEventListener('focus', () => {
            this.searchInput.parentElement.classList.add('scale-[1.02]');
        });
        this.searchInput.addEventListener('blur', () => {
            this.searchInput.parentElement.classList.remove('scale-[1.02]');
        });
    }

    async resolveSuiNSDomain(domain) {
        try {
            // Ensure domain is lowercase for consistent resolution
            domain = domain.toLowerCase();
            
            // First try the new method
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'suix_resolveNameServiceAddress',
                    params: [domain]
                })
            });
            
            const data = await response.json();
            console.log('SuiNS resolution response:', data);
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            if (!data.result) {
                throw new Error(`Domain "${domain}" is not registered`);
            }
            
            return data.result;
        } catch (error) {
            console.error('Error resolving SuiNS domain:', error);
            
            // If the first method fails, try the alternative endpoint
            try {
                const altResponse = await fetch('https://suins-api.k-g.me/name/address', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: domain.toLowerCase() })
                });
                
                const altData = await altResponse.json();
                console.log('Alternative SuiNS resolution response:', altData);
                
                if (altData.error || !altData.data) {
                    throw new Error(altData.error || 'Domain not found');
                }
                
                return altData.data;
            } catch (altError) {
                console.error('Error with alternative SuiNS resolution:', altError);
                throw new Error(`Could not resolve SuiNS domain "${domain}". The domain may not be registered.`);
            }
        }
    }

    async handleSearch() {
        const searchTerm = this.searchInput.value.trim();
        if (!searchTerm) {
            this.showError('Please enter a wallet address or SuiNS domain');
            return;
        }

        this.showLoading();
        try {
            let address = searchTerm;
            
            // If it's a .sui domain, resolve it first (case-insensitive check)
            if (searchTerm.toLowerCase().endsWith('.sui')) {
                // Convert to lowercase for consistent resolution
                address = await this.resolveSuiNSDomain(searchTerm.toLowerCase());
                if (!address) {
                    throw new Error(`Could not resolve SuiNS domain: ${searchTerm}`);
                }
            }

            // Validate the address format
            if (!address.startsWith('0x') || address.length !== 66) {
                throw new Error('Invalid wallet address format');
            }

            // Prepare the query based on selected type
            const selectedType = this.objectTypeSelect.value;
            console.log('Selected type:', selectedType);

            let query = {
                owner: address,
                limit: 50,
                options: {
                    showContent: true,
                    showDisplay: true,
                    showType: true
                }
            };

            // Add filter based on object type
            if (selectedType === 'walairdrop') {
                query.filter = {
                    MatchAll: [{
                        StructType: '0x98af8b8fde88f3c4bdf0fcedcf9afee7d10f66d480b74fb5a3a2e23dc7f5a564::airdrop::WALAirdrop'
                    }]
                };
                console.log('Using WAL Airdrop filter');
            } else if (selectedType === 'sui') {
                query.filter = {
                    MatchAll: [{
                        StructType: '0x2::coin::Coin<0x2::sui::SUI>'
                    }]
                };
                console.log('Using SUI token filter');
            } else if (selectedType === 'custom') {
                const customContract = this.customObjectInput.value.trim();
                console.log('Custom contract input value:', customContract);
                
                if (!customContract) {
                    throw new Error('Please enter a custom contract address');
                }

                // Format for token contracts
                let structType;
                if (customContract.includes('::')) {
                    const parts = customContract.split('::');
                    if (parts.length === 3) {
                        // Format: 0xADDRESS::MODULE::TYPE
                        structType = `0x2::coin::Coin<${parts[0]}::${parts[1]}::${parts[2]}>`;
                    } else {
                        structType = customContract;
                    }
                } else {
                    structType = customContract;
                }

                // Check if custom contract is a SuiNS domain
                if (structType.toLowerCase().endsWith('.sui')) {
                    // Convert to lowercase for consistent resolution
                    const resolvedAddress = await this.resolveSuiNSDomain(structType.toLowerCase());
                    if (!resolvedAddress) {
                        throw new Error(`Could not resolve SuiNS domain: ${structType}`);
                    }
                    structType = resolvedAddress;
                }

                console.log('Using struct type:', structType);
                query.filter = {
                    MatchAll: [{
                        StructType: structType
                    }]
                };
            }

            // Debug: Log the query being sent
            console.log('Sending query:', JSON.stringify(query, null, 2));

            // Make the API call
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'suix_getOwnedObjects',
                    params: [address, query]
                })
            });

            const data = await response.json();
            
            // Debug: Log the full response
            console.log('Full API response:', JSON.stringify(data, null, 2));
            
            if (data.error) {
                throw new Error(data.error.message || 'Failed to fetch wallet data');
            }

            const objects = data.result.data || [];
            this.renderWalletAirdrops(objects, address, searchTerm);

        } catch (error) {
            console.error('Search error:', error);
            this.showError(error.message);
        }

        this.hideLoading();
    }

    showLoading() {
        this.loadingSpinner.classList.remove('hidden');
        this.transactionContainer.innerHTML = '';
    }

    hideLoading() {
        this.loadingSpinner.classList.add('hidden');
    }

    formatAddress(address) {
        if (!address) return 'N/A';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    renderWalletAirdrops(objects, address, searchTerm) {
        if (!objects || objects.length === 0) {
            this.transactionContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-8 text-center">
                    <div class="w-20 h-20 mb-4 rounded-full bg-yellow-500/10 flex items-center justify-center">
                        <svg class="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold mb-2">No Objects Found</h3>
                    <p class="text-gray-400 max-w-md">
                        ${searchTerm.toLowerCase().endsWith('.sui') 
                            ? `No objects were found for ${searchTerm.toLowerCase()} (${this.formatAddress(address)})`
                            : `No objects were found for address: ${this.formatAddress(address)}`}
                    </p>
                </div>
            `;
            return;
        }

        const selectedType = this.objectTypeSelect.value;

        // For tokens, calculate total balance
        if (selectedType === 'sui' || selectedType === 'custom') {
            let totalBalance = 0n;
            let tokenType = '';
            let tokenName = '';

            objects.forEach(object => {
                const balance = BigInt(object.data.content?.fields?.balance || '0');
                totalBalance += balance;
                if (!tokenType && object.data.type) {
                    tokenType = object.data.type;
                    tokenName = tokenType.split('::').pop().replace(/[<>]/g, '');
                }
            });

            this.transactionContainer.innerHTML = `
                <div class="mb-6 text-center">
                    <div class="inline-flex items-center px-4 py-2 rounded-full bg-primary-500/10 text-primary-400 mb-3">
                        ${searchTerm.toLowerCase().endsWith('.sui') ? `
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                            </svg>
                            ${searchTerm.toLowerCase()}
                            <span class="text-xs ml-2 text-gray-400">(${this.formatAddress(address)})</span>
                        ` : `
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            ${this.formatAddress(address)}
                        `}
                    </div>
                    <h2 class="text-2xl font-semibold mb-1">${selectedType === 'sui' ? 'SUI Balance' : `${tokenName} Balance`}</h2>
                </div>
                <div class="flex justify-center">
                    ${this.renderTokenBalance(totalBalance, tokenType)}
                </div>
            `;
            return;
        }

        // For WAL Airdrops, use a more compact grid
        const gridClasses = objects.length === 1 ? 'md:grid-cols-3' : 
                          objects.length === 2 ? 'md:grid-cols-3' : 
                          'md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

        this.transactionContainer.innerHTML = `
            <div class="mb-4 text-center">
                <div class="inline-flex items-center px-4 py-2 rounded-full bg-primary-500/10 text-primary-400 mb-2">
                    ${searchTerm.toLowerCase().endsWith('.sui') ? `
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                        </svg>
                        ${searchTerm.toLowerCase()}
                        <span class="text-xs ml-2 text-gray-400">(${this.formatAddress(address)})</span>
                    ` : `
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        ${this.formatAddress(address)}
                    `}
                </div>
                <h2 class="text-xl font-semibold mb-1">WAL Airdrop Collection</h2>
                <p class="text-gray-400 text-sm">Found ${objects.length} object${objects.length === 1 ? '' : 's'}</p>
            </div>
            <div class="grid gap-3 ${gridClasses}">
                ${objects.map(object => {
                    const display = object.data.display?.data || {};
                    const imageUrl = display.image_url || 'https://placehold.co/400x400?text=No+Image';
                    const name = display.name || 'WAL Airdrop';
                    const description = display.description || 'No description available';
                    
                    return this.renderWalAirdropCard(imageUrl, name, description, object.data.objectId);
                }).join('')}
            </div>
        `;
    }

    renderTokenBalance(balance, type) {
        const formattedBalance = (Number(balance) / 1000000000).toLocaleString(undefined, { 
            minimumFractionDigits: 6,
            maximumFractionDigits: 6
        });
        const tokenName = type ? type.split('::').pop().replace(/[<>]/g, '') : 'Token';
        return `
            <div class="max-w-md w-full">
                <div class="transaction-item bg-gray-800/50 backdrop-blur-sm rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary-500/10 p-8">
                    <div class="flex items-center justify-center mb-6">
                        <svg class="w-16 h-16 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div class="text-center">
                        <h3 class="text-3xl font-bold text-white mb-2">${formattedBalance} ${tokenName}</h3>
                        <p class="text-gray-400">Total Balance</p>
                        ${type ? `<p class="text-xs text-gray-500 mt-2 break-all">${type}</p>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderWalAirdropCard(imageUrl, name, description, objectId) {
        return `
            <div class="group">
                <div class="transaction-item bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary-500/10">
                    <div class="aspect-square overflow-hidden">
                        <img src="${imageUrl}" 
                             alt="${name}"
                             class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                             onerror="this.src='https://placehold.co/400x400?text=Error+Loading+Image'">
                    </div>
                    <div class="p-2">
                        <h3 class="text-sm font-semibold text-white/90 truncate">${name}</h3>
                        <p class="text-xs text-gray-400 truncate">${description}</p>
                        <div class="text-[10px] text-gray-500 mt-1 truncate">${this.formatAddress(objectId)}</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderSuiTokenCard(balance, type) {
        const formattedBalance = (parseInt(balance) / 1000000000).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        const tokenName = type ? type.split('::').pop().replace(/[<>]/g, '') : 'Token';
        return `
            <div class="group">
                <div class="transaction-item bg-gray-800/50 backdrop-blur-sm rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary-500/10 p-6">
                    <div class="flex items-center justify-center mb-4">
                        <svg class="w-12 h-12 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div class="text-center">
                        <h3 class="text-2xl font-bold text-white mb-1">${formattedBalance} ${tokenName}</h3>
                        <p class="text-gray-400 text-sm">Balance</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderGenericObjectCard(type, fields) {
        return `
            <div class="group">
                <div class="transaction-item bg-gray-800/50 backdrop-blur-sm rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary-500/10 p-6">
                    <div class="mb-4">
                        <h3 class="text-base font-semibold text-white/90 truncate">${type.split('::').pop()}</h3>
                        <p class="text-xs text-gray-500 truncate">${type}</p>
                    </div>
                    <div class="space-y-2">
                        ${Object.entries(fields).map(([key, value]) => `
                            <div>
                                <p class="text-xs text-gray-400">${key}</p>
                                <p class="text-sm text-white truncate">${JSON.stringify(value)}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    showError(message) {
        this.transactionContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 text-center">
                <div class="w-24 h-24 mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                    <svg class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h3 class="text-xl font-semibold mb-2">Error</h3>
                <p class="text-gray-400 max-w-md">
                    ${message}
                </p>
            </div>
        `;
    }
}

// Create instance
const explorer = new WalAirdropExplorer();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => explorer.initialize());
} else {
    explorer.initialize();
}

export default explorer;
