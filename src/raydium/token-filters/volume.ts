import {fetchAMMPoolId} from "../Pool/fetch_pool";
import axios from 'axios';

interface RaydiumResponse {
    success: boolean;
    data: Array<{
        day: { volume: number };
        week: { volume: number };
        month: { volume: number };
    }>;
}

export async function getDayVolume(tokenAddress:string){
    try{
        const poolId = await fetchAMMPoolId(tokenAddress);
        let response = { data: null as RaydiumResponse['data'] | null, success: false };
        
        while(!response.success){
            console.log("The response was not successful when getting day volume, trying again")
            const result = await axios.get<RaydiumResponse>(`https://api-v3.raydium.io/pools/info/ids?ids=${poolId}`);
            response = result.data;
            if(response.success && response.data && response.data[0]) {
                const dayVolume = response.data[0].day.volume;
                console.log(dayVolume);
                return dayVolume;
            }
        }
    }catch(e){
        console.log("Error getting 24h volume: ", e)
        return 0;
    }
}

export async function getWeekVolume(tokenAddress:string){
    try{
        const poolId = await fetchAMMPoolId(tokenAddress);
        let response = { data: null as RaydiumResponse['data'] | null, success: false };
        
        while(!response.success){
            console.log("The response was not successful when getting week volume, trying again")
            const result = await axios.get<RaydiumResponse>(`https://api-v3.raydium.io/pools/info/ids?ids=${poolId}`);
            response = result.data;
            if(response.success && response.data && response.data[0]) {
                const weekVolume = response.data[0].week.volume;
                console.log(weekVolume);
                return weekVolume;
            }
        }
    }catch(e){
        console.log("Error getting week volume: ", e)
        return 0;
    }
}

export async function getMonthVolume(tokenAddress:string){
    try{
        const poolId = await fetchAMMPoolId(tokenAddress);
        let response = { data: null as RaydiumResponse['data'] | null, success: false };
        
        while(!response.success){
            console.log("The response was not successful when getting month volume, trying again")
            const result = await axios.get<RaydiumResponse>(`https://api-v3.raydium.io/pools/info/ids?ids=${poolId}`);
            response = result.data;
            if(response.success && response.data && response.data[0]) {
                const monthVolume = response.data[0].month.volume;
                console.log(monthVolume);
                return monthVolume;
            }
        }
    }catch(e){
        console.log("Error getting month volume: ", e)
        return 0;
    }
}

//getMonthVolume("GiMsMKgMq3cX3PJwPZCxh6CsrsVTc5P975eeAMPLpump");