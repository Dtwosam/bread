// GENERATED from exact Foundry artifacts by scripts/abi/generate-bread-abi.mjs.
// Do not edit by hand.
export const breadAbiRegistry = {
  "factory": [
    {
      "type": "error",
      "name": "CreatorRecipientZeroAddress",
      "inputs": []
    },
    {
      "type": "error",
      "name": "CreatorTaxAboveCurrentMaximum",
      "inputs": [
        {
          "name": "creatorTaxBps",
          "type": "uint16",
          "internalType": "uint16"
        },
        {
          "name": "maxCreatorTaxBps",
          "type": "uint16",
          "internalType": "uint16"
        }
      ]
    },
    {
      "type": "error",
      "name": "EmptyStackVersion",
      "inputs": []
    },
    {
      "type": "error",
      "name": "EmptyTokenName",
      "inputs": []
    },
    {
      "type": "error",
      "name": "EmptyTokenSymbol",
      "inputs": []
    },
    {
      "type": "error",
      "name": "GraduationCoordinatorAlreadySet",
      "inputs": []
    },
    {
      "type": "error",
      "name": "GraduationCoordinatorNotSet",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InitialBuyRecipientZeroAddress",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InitialBuyZeroAmount",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidGraduationAdapter",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidGraduationCoordinator",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidLaunchConfig",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidLaunchDeployer",
      "inputs": []
    },
    {
      "type": "error",
      "name": "LaunchDeployerAlreadySet",
      "inputs": []
    },
    {
      "type": "error",
      "name": "LaunchDeployerNotSet",
      "inputs": []
    },
    {
      "type": "error",
      "name": "LaunchDisabled",
      "inputs": []
    },
    {
      "type": "error",
      "name": "LaunchesRestricted",
      "inputs": []
    },
    {
      "type": "error",
      "name": "OwnableInvalidOwner",
      "inputs": [
        {
          "name": "owner",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnableUnauthorizedAccount",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "ReentrancyGuardReentrantCall",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ResidualFactoryCustody",
      "inputs": [
        {
          "name": "expectedBalance",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "actualBalance",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "SafeERC20FailedOperation",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "StaleEconomics",
      "inputs": [
        {
          "name": "expected",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "actual",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ]
    },
    {
      "type": "error",
      "name": "UnexpectedReceivedAmount",
      "inputs": [
        {
          "name": "expected",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "actual",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "ZeroAddress",
      "inputs": []
    },
    {
      "type": "event",
      "name": "GraduationCoordinatorSet",
      "inputs": [
        {
          "name": "graduationCoordinator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "LaunchAndBuyExecuted",
      "inputs": [
        {
          "name": "buyer",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "curve",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "recipient",
          "type": "address",
          "indexed": false,
          "internalType": "address"
        },
        {
          "name": "quoteIn",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "spent",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "refund",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "tokensOut",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "LaunchConfigUpdated",
      "inputs": [
        {
          "name": "previousVersion",
          "type": "uint64",
          "indexed": true,
          "internalType": "uint64"
        },
        {
          "name": "nextVersion",
          "type": "uint64",
          "indexed": true,
          "internalType": "uint64"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "LaunchCreated",
      "inputs": [
        {
          "name": "deployer",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "curve",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "creatorFeeRecipient",
          "type": "address",
          "indexed": false,
          "internalType": "address"
        },
        {
          "name": "creatorTaxBps",
          "type": "uint16",
          "indexed": false,
          "internalType": "uint16"
        },
        {
          "name": "economicsDigest",
          "type": "bytes32",
          "indexed": false,
          "internalType": "bytes32"
        },
        {
          "name": "configVersion",
          "type": "uint64",
          "indexed": false,
          "internalType": "uint64"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "LaunchDeployerSet",
      "inputs": [
        {
          "name": "launchDeployer",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "LaunchFeeCredited",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "protocolRecipient",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnershipTransferred",
      "inputs": [
        {
          "name": "previousOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "function",
      "name": "configVersion",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "currentLaunchConfig",
      "inputs": [],
      "outputs": [
        {
          "name": "config",
          "type": "tuple",
          "internalType": "struct IBreadLaunchFactory.LaunchConfig",
          "components": [
            {
              "name": "supply",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "phantomQuote",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "graduationThreshold",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "launchFeeUsdc",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "graduationAdapter",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "graduationConfigHash",
              "type": "bytes32",
              "internalType": "bytes32"
            },
            {
              "name": "enabled",
              "type": "bool",
              "internalType": "bool"
            }
          ]
        },
        {
          "name": "version",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "emergencyController",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IBreadEmergencyController"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "feeEscrow",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "feePolicy",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IBreadFeePolicy"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getLaunch",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "record",
          "type": "tuple",
          "internalType": "struct IBreadLaunchFactory.LaunchRecord",
          "components": [
            {
              "name": "token",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "curve",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "deployer",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "creatorFeeRecipient",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "creatorTaxBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "economicsDigest",
              "type": "bytes32",
              "internalType": "bytes32"
            },
            {
              "name": "launchTimestamp",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "configVersion",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "graduationCoordinator",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "graduationAdapter",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "graduationAdapterFamily",
              "type": "uint8",
              "internalType": "enum IGraduationAdapter.AdapterFamily"
            },
            {
              "name": "graduationConfigHash",
              "type": "bytes32",
              "internalType": "bytes32"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "graduationCoordinator",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IGraduationCoordinator"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "launchDeployer",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract BreadLaunchDeployer"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "launchToken",
      "inputs": [
        {
          "name": "params",
          "type": "tuple",
          "internalType": "struct IBreadLaunchFactory.LaunchParams",
          "components": [
            {
              "name": "name",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "symbol",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "logo",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "description",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "twitter",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "telegram",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "discord",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "website",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "farcaster",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "creatorFeeRecipient",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "creatorTaxBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "expectedEconomics",
              "type": "bytes32",
              "internalType": "bytes32"
            }
          ]
        }
      ],
      "outputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "curve",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "launchTokenAndBuy",
      "inputs": [
        {
          "name": "params",
          "type": "tuple",
          "internalType": "struct IBreadLaunchFactory.LaunchParams",
          "components": [
            {
              "name": "name",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "symbol",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "logo",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "description",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "twitter",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "telegram",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "discord",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "website",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "farcaster",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "creatorFeeRecipient",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "creatorTaxBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "expectedEconomics",
              "type": "bytes32",
              "internalType": "bytes32"
            }
          ]
        },
        {
          "name": "quoteIn",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "minTokensOut",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "recipient",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "curve",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "tokensOut",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "previewLaunchEconomics",
      "inputs": [],
      "outputs": [
        {
          "name": "digest",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "stackVersion",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "tokenForCurve",
      "inputs": [
        {
          "name": "curve",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "usdc",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    }
  ],
  "curve": [
    {
      "type": "error",
      "name": "AlreadyInitialized",
      "inputs": []
    },
    {
      "type": "error",
      "name": "BuysRestricted",
      "inputs": []
    },
    {
      "type": "error",
      "name": "CreatorTaxAboveSnapshotMaximum",
      "inputs": [
        {
          "name": "creatorTaxBps",
          "type": "uint16",
          "internalType": "uint16"
        },
        {
          "name": "maxCreatorTaxBps",
          "type": "uint16",
          "internalType": "uint16"
        }
      ]
    },
    {
      "type": "error",
      "name": "CurveClosed",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InsufficientFinalFillInput",
      "inputs": [
        {
          "name": "required",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "actual",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "InsufficientInputAmount",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InsufficientLiquidity",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InsufficientOutputAmount",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidLaunchEconomics",
      "inputs": []
    },
    {
      "type": "error",
      "name": "LaunchBuyExemptionAlreadyConsumed",
      "inputs": []
    },
    {
      "type": "error",
      "name": "LaunchBuyExemptionExpired",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NoFeesToSweep",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotInitialized",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotReadyToGraduate",
      "inputs": []
    },
    {
      "type": "error",
      "name": "RecipientZeroAddress",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ReentrancyGuardReentrantCall",
      "inputs": []
    },
    {
      "type": "error",
      "name": "SafeERC20FailedOperation",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "SellsRestricted",
      "inputs": []
    },
    {
      "type": "error",
      "name": "SlippageExceeded",
      "inputs": [
        {
          "name": "minimum",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "actual",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "UnauthorizedFactory",
      "inputs": []
    },
    {
      "type": "error",
      "name": "UnauthorizedFeeSweep",
      "inputs": []
    },
    {
      "type": "error",
      "name": "UnauthorizedGraduationCoordinator",
      "inputs": []
    },
    {
      "type": "error",
      "name": "UnexpectedReceivedAmount",
      "inputs": [
        {
          "name": "expected",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "received",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "ZeroAddress",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ZeroAmount",
      "inputs": []
    },
    {
      "type": "event",
      "name": "CreatorFeeRecipientUpdated",
      "inputs": [
        {
          "name": "previousRecipient",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "nextRecipient",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "CurveBuy",
      "inputs": [
        {
          "name": "buyer",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "recipient",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "quoteIn",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "tokensOut",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "fee",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "tax",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "CurveBuyRefunded",
      "inputs": [
        {
          "name": "buyer",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "refund",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "CurveGraduationReleased",
      "inputs": [
        {
          "name": "coordinator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "seedUsdc",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "tokenOut",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "protocolFeeAmount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "creatorFeeAmount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "CurveSell",
      "inputs": [
        {
          "name": "seller",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "recipient",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "tokensIn",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "quoteOut",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "fee",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "tax",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "FeesSwept",
      "inputs": [
        {
          "name": "protocolAmount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "creatorAmount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "creatorTaxAmount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "GraduationAutoAttemptFailed",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "reasonHash",
          "type": "bytes32",
          "indexed": false,
          "internalType": "bytes32"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "GraduationReady",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "curve",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "coordinator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OpeningProtectionApplied",
      "inputs": [
        {
          "name": "buyer",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "recipient",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "taxBps",
          "type": "uint16",
          "indexed": false,
          "internalType": "uint16"
        },
        {
          "name": "taxAmount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "launchBuyExempt",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        }
      ],
      "anonymous": false
    },
    {
      "type": "function",
      "name": "buy",
      "inputs": [
        {
          "name": "quoteIn",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "minTokensOut",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "recipient",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "tokensOut",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "creatorFeeRecipient",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "creatorTaxBalance",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "creatorTaxBps",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "currentSnipeTaxBps",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "emergencyController",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IBreadEmergencyController"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "factory",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "feeEscrow",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IBreadFeeEscrow"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "feePolicy",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IBreadFeePolicy"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getReserves",
      "inputs": [],
      "outputs": [
        {
          "name": "quoteReserve_",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "tokenReserve_",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "graduated",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "graduationCoordinator",
      "inputs": [],
      "outputs": [
        {
          "name": "coordinator",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "graduationThreshold",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "launchBuyExemptionConsumed",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "launchTimestamp",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "maxCreatorTaxBps",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "pairToken",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "phantomQuote",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "protocolFeeRecipient",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "protocolFeeShareBps",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "quoteFeeBalance",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "quoteReserve",
      "inputs": [],
      "outputs": [
        {
          "name": "quoteReserve_",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "readyToGraduate",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "realQuoteReserve",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "releaseForGraduation",
      "inputs": [],
      "outputs": [
        {
          "name": "seedUsdc",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "tokenOut",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "protocolFeeAmount",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "creatorFeeAmount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "reservedTokens",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "sell",
      "inputs": [
        {
          "name": "tokensIn",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "minQuoteOut",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "recipient",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "quoteOut",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "sellableTokens",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "sweepFees",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "token",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "tokenReserve",
      "inputs": [],
      "outputs": [
        {
          "name": "tokenReserve_",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "trackedQuote",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "trackedTokens",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "tradeFeeBps",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "stateMutability": "view"
    }
  ],
  "feeEscrow": [
    {
      "type": "error",
      "name": "CreditorMustBeContract",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NoFeesToClaim",
      "inputs": []
    },
    {
      "type": "error",
      "name": "OwnableInvalidOwner",
      "inputs": [
        {
          "name": "owner",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnableUnauthorizedAccount",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "RecipientZeroAddress",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ReentrancyGuardReentrantCall",
      "inputs": []
    },
    {
      "type": "error",
      "name": "SafeERC20FailedOperation",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "TokenZeroAddress",
      "inputs": []
    },
    {
      "type": "error",
      "name": "UnauthorizedCreditor",
      "inputs": []
    },
    {
      "type": "error",
      "name": "UnexpectedReceivedAmount",
      "inputs": [
        {
          "name": "expected",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "received",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "ZeroAmount",
      "inputs": []
    },
    {
      "type": "event",
      "name": "AuthorizedCreditorUpdated",
      "inputs": [
        {
          "name": "creditor",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "allowed",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "FeeClaimed",
      "inputs": [
        {
          "name": "recipient",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "remainingBalance",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "totalOutstanding",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "FeeCredited",
      "inputs": [
        {
          "name": "creditor",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "recipient",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "recipientBalance",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "totalOutstanding",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnershipTransferred",
      "inputs": [
        {
          "name": "previousOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "function",
      "name": "authorizedCreditor",
      "inputs": [
        {
          "name": "creditor",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "allowed",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "balanceOf",
      "inputs": [
        {
          "name": "recipient",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "claim",
      "inputs": [],
      "outputs": [
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "claim",
      "inputs": [
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "claimed",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "surplus",
      "inputs": [],
      "outputs": [
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "totalOutstanding",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "usdc",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IERC20"
        }
      ],
      "stateMutability": "view"
    }
  ],
  "feePolicy": [
    {
      "type": "error",
      "name": "CombinedTradeFeeInvalid",
      "inputs": [
        {
          "name": "tradeFeeBps",
          "type": "uint16",
          "internalType": "uint16"
        },
        {
          "name": "maxCreatorTaxBps",
          "type": "uint16",
          "internalType": "uint16"
        }
      ]
    },
    {
      "type": "error",
      "name": "CreatorTaxInvalid",
      "inputs": [
        {
          "name": "maxCreatorTaxBps",
          "type": "uint16",
          "internalType": "uint16"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnableInvalidOwner",
      "inputs": [
        {
          "name": "owner",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnableUnauthorizedAccount",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "ProtocolFeeRecipientZeroAddress",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ProtocolFeeShareInvalid",
      "inputs": [
        {
          "name": "protocolFeeShareBps",
          "type": "uint16",
          "internalType": "uint16"
        }
      ]
    },
    {
      "type": "error",
      "name": "TradeFeeInvalid",
      "inputs": [
        {
          "name": "tradeFeeBps",
          "type": "uint16",
          "internalType": "uint16"
        }
      ]
    },
    {
      "type": "event",
      "name": "FeePolicyUpdated",
      "inputs": [
        {
          "name": "previousPolicy",
          "type": "tuple",
          "indexed": false,
          "internalType": "struct BreadFeePolicySnapshot",
          "components": [
            {
              "name": "protocolFeeRecipient",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "tradeFeeBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "protocolFeeShareBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "maxCreatorTaxBps",
              "type": "uint16",
              "internalType": "uint16"
            }
          ]
        },
        {
          "name": "nextPolicy",
          "type": "tuple",
          "indexed": false,
          "internalType": "struct BreadFeePolicySnapshot",
          "components": [
            {
              "name": "protocolFeeRecipient",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "tradeFeeBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "protocolFeeShareBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "maxCreatorTaxBps",
              "type": "uint16",
              "internalType": "uint16"
            }
          ]
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "FeeSweepOperatorUpdated",
      "inputs": [
        {
          "name": "previousOperator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "nextOperator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnershipTransferred",
      "inputs": [
        {
          "name": "previousOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "function",
      "name": "currentFeePolicy",
      "inputs": [],
      "outputs": [
        {
          "name": "policy",
          "type": "tuple",
          "internalType": "struct BreadFeePolicySnapshot",
          "components": [
            {
              "name": "protocolFeeRecipient",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "tradeFeeBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "protocolFeeShareBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "maxCreatorTaxBps",
              "type": "uint16",
              "internalType": "uint16"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "feeSweepOperator",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    }
  ],
  "emergencyController": [
    {
      "type": "error",
      "name": "GuardianCannotClearGraduationPause",
      "inputs": []
    },
    {
      "type": "error",
      "name": "GuardianCannotReduceRestriction",
      "inputs": []
    },
    {
      "type": "error",
      "name": "OwnableInvalidOwner",
      "inputs": [
        {
          "name": "owner",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnableUnauthorizedAccount",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnershipRenounceDisabled",
      "inputs": []
    },
    {
      "type": "error",
      "name": "UnauthorizedEmergencyActor",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ZeroAddress",
      "inputs": []
    },
    {
      "type": "event",
      "name": "GraduationPauseUpdated",
      "inputs": [
        {
          "name": "actor",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "previousPaused",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        },
        {
          "name": "nextPaused",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "GuardianUpdated",
      "inputs": [
        {
          "name": "previousGuardian",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "nextGuardian",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnershipTransferred",
      "inputs": [
        {
          "name": "previousOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "RestrictionModeUpdated",
      "inputs": [
        {
          "name": "actor",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "previousMode",
          "type": "uint8",
          "indexed": false,
          "internalType": "enum IBreadEmergencyController.RestrictionMode"
        },
        {
          "name": "nextMode",
          "type": "uint8",
          "indexed": false,
          "internalType": "enum IBreadEmergencyController.RestrictionMode"
        }
      ],
      "anonymous": false
    },
    {
      "type": "function",
      "name": "buysAllowed",
      "inputs": [],
      "outputs": [
        {
          "name": "allowed",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "graduationPaused",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "guardian",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "launchesAllowed",
      "inputs": [],
      "outputs": [
        {
          "name": "allowed",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "restrictionMode",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint8",
          "internalType": "enum IBreadEmergencyController.RestrictionMode"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "sellsAllowed",
      "inputs": [],
      "outputs": [
        {
          "name": "allowed",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    }
  ],
  "coordinator": [
    {
      "type": "error",
      "name": "CurveNotReady",
      "inputs": []
    },
    {
      "type": "error",
      "name": "GraduationAdapterInvalid",
      "inputs": []
    },
    {
      "type": "error",
      "name": "GraduationCoordinatorMismatch",
      "inputs": []
    },
    {
      "type": "error",
      "name": "GraduationMustBePausedForRescue",
      "inputs": []
    },
    {
      "type": "error",
      "name": "GraduationPaused",
      "inputs": []
    },
    {
      "type": "error",
      "name": "GraduationRescueTooEarly",
      "inputs": [
        {
          "name": "availableAt",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "GraduationSeedNotViable",
      "inputs": []
    },
    {
      "type": "error",
      "name": "GraduationTransferMismatch",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InsufficientGraduationCustody",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidAdapterResult",
      "inputs": []
    },
    {
      "type": "error",
      "name": "OwnableInvalidOwner",
      "inputs": [
        {
          "name": "owner",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnableUnauthorizedAccount",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnershipRenounceDisabled",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ReentrancyGuardReentrantCall",
      "inputs": []
    },
    {
      "type": "error",
      "name": "SafeERC20FailedOperation",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "TokenNotFound",
      "inputs": []
    },
    {
      "type": "error",
      "name": "WrongGraduationPhase",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ZeroAddress",
      "inputs": []
    },
    {
      "type": "event",
      "name": "GraduationCompleted",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "adapter",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "poolId",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "positionManager",
          "type": "address",
          "indexed": false,
          "internalType": "address"
        },
        {
          "name": "positionId",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "usdcUsed",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "tokenUsed",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "tokenLocked",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "usdcDust",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "GraduationRescued",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "recipient",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "usdcAmount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "tokenAmount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "GraduationSwept",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "adapter",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "usdcAmount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "tokenAmount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "sweptAt",
          "type": "uint64",
          "indexed": false,
          "internalType": "uint64"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "GraduationTokenResidueLocked",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "GraduationUsdcDustCredited",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "recipient",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnershipTransferred",
      "inputs": [
        {
          "name": "previousOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "function",
      "name": "createPool",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "poolId",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "positionId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "emergencyController",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "factory",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "feeEscrow",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getGraduation",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "record",
          "type": "tuple",
          "internalType": "struct IGraduationCoordinator.GraduationRecord",
          "components": [
            {
              "name": "phase",
              "type": "uint8",
              "internalType": "enum IGraduationCoordinator.GraduationPhase"
            },
            {
              "name": "sweptAt",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "sweptUsdc",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "sweptTokens",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "poolTokenAmount",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "poolId",
              "type": "bytes32",
              "internalType": "bytes32"
            },
            {
              "name": "positionManager",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "positionId",
              "type": "uint256",
              "internalType": "uint256"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "locker",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "sweep",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "totalSweptUsdc",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "usdc",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    }
  ],
  "locker": [
    {
      "type": "error",
      "name": "AlreadyInitialized",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidCoordinator",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotCoordinator",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotWiringAuthority",
      "inputs": []
    },
    {
      "type": "error",
      "name": "PositionAlreadyLocked",
      "inputs": []
    },
    {
      "type": "error",
      "name": "PositionNotHeld",
      "inputs": []
    },
    {
      "type": "error",
      "name": "SafeERC20FailedOperation",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "UnexpectedReceivedAmount",
      "inputs": [
        {
          "name": "expected",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "actual",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "ZeroAddress",
      "inputs": []
    },
    {
      "type": "event",
      "name": "CoordinatorSet",
      "inputs": [
        {
          "name": "coordinator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PositionLocked",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "positionManager",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "positionId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "TokenSupplyLocked",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "totalLocked",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "function",
      "name": "coordinator",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "isPositionLocked",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "locked",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "lockedPosition",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "positionManager",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "positionId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "lockedTokenSupply",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "wiringAuthority",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    }
  ],
  "launchToken": [
    {
      "type": "error",
      "name": "ERC20InsufficientAllowance",
      "inputs": [
        {
          "name": "spender",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "allowance",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "needed",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "ERC20InsufficientBalance",
      "inputs": [
        {
          "name": "sender",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "balance",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "needed",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "ERC20InvalidApprover",
      "inputs": [
        {
          "name": "approver",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "ERC20InvalidReceiver",
      "inputs": [
        {
          "name": "receiver",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "ERC20InvalidSender",
      "inputs": [
        {
          "name": "sender",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "ERC20InvalidSpender",
      "inputs": [
        {
          "name": "spender",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "ZeroAddress",
      "inputs": []
    },
    {
      "type": "event",
      "name": "Approval",
      "inputs": [
        {
          "name": "owner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "spender",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "value",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Transfer",
      "inputs": [
        {
          "name": "from",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "to",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "value",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "function",
      "name": "allowance",
      "inputs": [
        {
          "name": "owner",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "spender",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "approve",
      "inputs": [
        {
          "name": "spender",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "value",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "balanceOf",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "curve",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "decimals",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint8",
          "internalType": "uint8"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "deployer",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "description",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getTokenInfo",
      "inputs": [],
      "outputs": [
        {
          "name": "tokenDeployer",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "tokenLogo",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "tokenDescription",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "tokenSocials",
          "type": "tuple",
          "internalType": "struct BreadLaunchToken.Socials",
          "components": [
            {
              "name": "twitter",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "telegram",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "discord",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "website",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "farcaster",
              "type": "string",
              "internalType": "string"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "launchFactory",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "logo",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "name",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "socials",
      "inputs": [],
      "outputs": [
        {
          "name": "twitter",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "telegram",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "discord",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "website",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "farcaster",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "symbol",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "totalSupply",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "transfer",
      "inputs": [
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "value",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "transferFrom",
      "inputs": [
        {
          "name": "from",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "value",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "nonpayable"
    }
  ]
} as const;
