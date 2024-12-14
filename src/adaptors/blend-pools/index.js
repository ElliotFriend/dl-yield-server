const utils = require('../utils');
const { Pool, PoolConfig, ReserveData, BackstopConfig, FixedMath } = require('@blend-capital/blend-sdk')
const { PromisePool } = require("@supercharge/promise-pool");
const { BigNumber } = require('bignumber.js');
const { Contract, rpc } = require('@stellar/stellar-sdk')

const BACKSTOP_ID = "CAO3AGAMZVRMHITL36EJ2VZQWKYRPWMQAPDQD5YEOF3GIF7T44U4JAL3";
const XLM_ADDRESS = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
const USDC_ADDRESS = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const BLND_ADDRESS = "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY";
const poolTokens = ["coingecko:stellar", "coingecko:aquarius", "coingecko:euro-coin", "coingecko:blend"]

const network = {
  rpc: "https://soroban-rpc.creit.tech/",
  passphrase: "Public Global Stellar Network ; September 2015",
};
const server = new rpc.Server(network.rpc);

const apy = async () => {
    const ptPrices = await utils.getPrices(poolTokens)
    const usdcPerBlnd = ptPrices.pricesBySymbol["blnd"]

    let backstop = await BackstopConfig.load(network, BACKSTOP_ID);
    let apyPools = []

    for (const activePool of backstop.rewardZone) {
        let pool = await Pool.load(network, activePool)
        let backstopToken = pool.config.backstopRate

        if (pool.config.status === 1) {
            pool.reserves.forEach((reserve) => {
                const rSymbol = reserve.tokenMetadata.symbol
                const rPrice = rSymbol === 'USDC' || rSymbol === 'USDx'
                    ? 1
                    : rSymbol === 'EURx'
                    ? ptPrices.pricesBySymbol['eurc']
                    : ptPrices.pricesBySymbol[rSymbol.toLowerCase()]

                const supply = Number(reserve.data.bSupply) * Number(reserve.data.bRate) / 1e9;
                const borrowed = Number(reserve.data.dSupply) * Number(reserve.data.dRate) / 1e9;
                const tvl = (supply - borrowed) / 10_000_000

                const tvlUsd = tvl * rPrice

                apyPools.push({
                    pool: `${pool.id}-${reserve.assetId}-stellar`,
                    chain: "Stellar",
                    project: "blend-pools",
                    symbol: rSymbol,
                    tvlUsd: tvlUsd,
                    apyBase: reserve.supplyApr,
                    apyReward: (reserve.emissionsPerYearPerSuppliedAsset() * usdcPerBlnd) / rPrice,
                    rewardTokens: [BLND_ADDRESS],
                    underlyingTokens: [reserve.assetId],
                    poolMeta: `Blend ${pool.config.name} Pool`,
                    url: `https://mainnet.blend.capital/asset/?poolId=${pool.id}&assetId=${reserve.assetId}`,
                    apyBaseBorrow: reserve.borrowApr,
                    apyRewardBorrow: (reserve.emissionsPerYearPerBorrowedAsset() * usdcPerBlnd) / rPrice,
                    totalSupplyUsd: supply / 10_000_000,
                    totalBorrowUsd: borrowed / 10_000_000,
                })
            })
        }
    }
    return apyPools
}

module.exports = {
    timetravel: false,
    apy: apy,
    url: 'https://mainnet.blend.capital'
}
