import React from "react";
import { ethers } from "ethers";
import TokenArtifact from "../contracts/Token.json"; // Ensure this is the correct path
import contractAddress from "../contracts/contract-address.json"; // Ensure this is the correct path
import { NoWalletDetected } from "./NoWalletDetected"; // Component for when no wallet is detected
import { ConnectWallet } from "./ConnectWallet"; // Component to connect wallet
import { Loading } from "./Loading"; // Loading component while data is being fetched
import { Transfer } from "./Transfer"; // Component for transferring tokens
import { TransactionErrorMessage } from "./TransactionErrorMessage"; // Display transaction errors
import { WaitingForTransactionMessage } from "./WaitingForTransactionMessage"; // Waiting for transaction confirmation
import { NoTokensMessage } from "./NoTokensMessage"; // For when the user has no tokens

const HARDHAT_NETWORK_ID = '31337'; // Network ID for Hardhat local blockchain
const ERROR_CODE_TX_REJECTED_BY_USER = 4001; // Error code for transaction rejection by the user

export class Dapp extends React.Component {
    constructor(props) {
        super(props);

        this.initialState = {
            tokenData: undefined,
            selectedAddress: undefined,
            balance: undefined,
            txBeingSent: undefined,
            transactionError: undefined,
            networkError: undefined,
            totalSupply: undefined, // State to hold total supply of the token
        };

        this.state = this.initialState; // Initialize state
    }

    // Render function for UI components based on state
    render() {
        // If no wallet is detected
        if (window.ethereum === undefined) {
            return <NoWalletDetected />;
        }

        // If no wallet address is selected
        if (!this.state.selectedAddress) {
            return (
                <ConnectWallet 
                    connectWallet={() => this._connectWallet()} 
                    networkError={this.state.networkError}
                    dismiss={() => this._dismissNetworkError()}
                />
            );
        }

        // Loading state while token data and balance are being fetched
        if (!this.state.tokenData || this.state.balance === undefined) {
            return <Loading />;
        }

        // Main UI for the Dapp
        return (
            <div className="container p-4">
                <div className="row">
                    <div className="col-12">
                        <h1>
                            {this.state.tokenData.name} ({this.state.tokenData.symbol})
                        </h1>
                        <p>
                            Welcome <b>{this.state.selectedAddress}</b>, you have{" "}
                            <b>
                                {this.state.balance.toString()} {this.state.tokenData.symbol}
                            </b>
                            . Total Supply: <b>{this.state.totalSupply.toString()}</b> tokens.
                        </p>
                    </div>
                </div>

                <hr />

                <div className="row">
                    <div className="col-12">
                        {this.state.txBeingSent && (
                            <WaitingForTransactionMessage txHash={this.state.txBeingSent} />
                        )}
                        {this.state.transactionError && (
                            <TransactionErrorMessage
                                message={this._getRpcErrorMessage(this.state.transactionError)}
                                dismiss={() => this._dismissTransactionError()}
                            />
                        )}
                    </div>
                </div>

                <div className="row">
                    <div className="col-12">
                        {this.state.balance.eq(0) && (
                            <NoTokensMessage selectedAddress={this.state.selectedAddress} />
                        )}
                        {this.state.balance.gt(0) && (
                            <Transfer
                                transferTokens={(to, amount) =>
                                    this._transferTokens(to, amount)
                                }
                                tokenSymbol={this.state.tokenData.symbol}
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Lifecycle method to stop polling data when component unmounts
    componentWillUnmount() {
        this._stopPollingData();
    }

    // Method to connect to MetaMask wallet
    async _connectWallet() {
        if (window.ethereum) {
            try {
                const [selectedAddress] = await window.ethereum.request({ method: 'eth_requestAccounts' });
                this._checkNetwork(); // Check if connected to the correct network
                this._initialize(selectedAddress); // Initialize Dapp with selected address
            } catch (error) {
                console.error("Error connecting to wallet:", error);
                alert("Error connecting to wallet. Please try again.");
            }
        } else {
            alert("MetaMask is not installed. Please install it.");
        }
    }

    // Initialize Dapp with user address
    _initialize(userAddress) {
        this.setState({
            selectedAddress: userAddress,
        });
        this._initializeEthers();
        this._getTokenData();
        this._startPollingData();
    }

    // Initialize ethers.js provider and contract instance
    async _initializeEthers() {
        this._provider = new ethers.providers.Web3Provider(window.ethereum);
        this._token = new ethers.Contract(
            contractAddress.Token,
            TokenArtifact.abi,
            this._provider.getSigner(0)
        );

        // Fetch total supply of the token
        const totalSupply = await this._token.totalSupply();
        this.setState({ totalSupply }); // Store total supply in state
    }

    // Start polling for balance updates
    _startPollingData() {
        this._pollDataInterval = setInterval(() => this._updateBalance(), 1000);
        this._updateBalance();
    }

    // Stop polling for balance updates
    _stopPollingData() {
        clearInterval(this._pollDataInterval);
        this._pollDataInterval = undefined;
    }

    // Fetch token data (name, symbol)
    async _getTokenData() {
        const name = await this._token.name();
        const symbol = await this._token.symbol();
        this.setState({ tokenData: { name, symbol } });
    }

    // Update balance for the selected address
    async _updateBalance() {
        const balance = await this._token.balanceOf(this.state.selectedAddress);
        this.setState({ balance });
    }

    // Transfer tokens to another address
    async _transferTokens(to, amount) {
        try {
            this._dismissTransactionError();
            const decimals = await this._token.decimals(); // Fetch token decimals
            const tx = await this._token.transfer(to, ethers.utils.parseUnits(amount.toString(), decimals));
            this.setState({ txBeingSent: tx.hash });
            const receipt = await tx.wait();
            if (receipt.status === 0) {
                throw new Error("Transaction failed");
            }
            await this._updateBalance();
        } catch (error) {
            if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) {
                return;
            }
            console.error(error);
            this.setState({ transactionError: error });
        } finally {
            this.setState({ txBeingSent: undefined });
        }
    }

    // Dismiss transaction error message
    _dismissTransactionError() {
        this.setState({ transactionError: undefined });
    }

    // Dismiss network error message
    _dismissNetworkError() {
        this.setState({ networkError: undefined });
    }

    // Get RPC error message for display
    _getRpcErrorMessage(error) {
        if (error.data) {
            return error.data.message;
        }
        return error.message;
    }

    // Reset Dapp state
    _resetState() {
        this.setState(this.initialState);
    }

    // Switch Ethereum chain to Hardhat network
    async _switchChain() {
        const chainIdHex = `0x${HARDHAT_NETWORK_ID.toString(16)}`;
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex }],
        });
        await this._initialize(this.state.selectedAddress);
    }

    // Check if the wallet is connected to the correct network
    _checkNetwork() {
        if (window.ethereum.networkVersion !== HARDHAT_NETWORK_ID) {
            this._switchChain();
        }
    }
}
