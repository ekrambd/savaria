import dotenv from 'dotenv';
try {
  dotenv.config({ path: '.env.local' });
  dotenv.config();
} catch {}

export interface SteadfastCredentials {
  apiKey?: string;
  secretKey?: string;
  baseUrl?: string;
}

export interface SteadfastDispatchParams {
  order: {
    id: string;
    customerName: string;
    phone: string;
    address: string;
    district?: string;
    totalPrice: number;
    status?: string;
    productTitle?: string;
    paymentMethod?: string;
    steadfastTrackingCode?: string;
  };
  credentials?: SteadfastCredentials;
}

export class SteadfastCourierService {
  private static getConfig(customCreds?: SteadfastCredentials) {
    const apiKey = (customCreds?.apiKey || process.env.STEADFAST_API_KEY || '').trim();
    const secretKey = (customCreds?.secretKey || process.env.STEADFAST_SECRET_KEY || '').trim();
    const baseUrl = (customCreds?.baseUrl || process.env.STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1').replace(/\/$/, '');
    
    if (!apiKey || !secretKey) {
      throw new Error('Steadfast credentials (API Key & Secret Key) are not configured. Please save them in Courier Settings.');
    }
    return { apiKey, secretKey, baseUrl };
  }

  private static async request(path: string, customCreds?: SteadfastCredentials, init?: RequestInit) {
    const { apiKey, secretKey, baseUrl } = this.getConfig(customCreds);
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        ...init?.headers
      },
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || (data.status && Number(data.status) >= 400)) {
      throw new Error(data.message || `Steadfast returned HTTP ${response.status}`);
    }
    return data;
  }

  static async testConnection(customCreds?: SteadfastCredentials) {
    const data = await this.request('/get_balance', customCreds);
    if (Number(data.status) !== 200) {
      throw new Error(data.message || 'Steadfast credentials were rejected');
    }
    return {
      success: true,
      balance: Number(data.current_balance || 0),
      message: 'Steadfast API connection verified successfully!'
    };
  }

  static async dispatchOrder(params: SteadfastDispatchParams) {
    const { order, credentials } = params;
    if (!order?.id || !order.customerName || !order.phone || !order.address) {
      throw new Error('Order name, phone, address, and invoice are required');
    }
    if (order.steadfastTrackingCode) {
      throw new Error('This order already has a Steadfast tracking code');
    }

    try {
      const isPrepaid = order.paymentMethod && order.paymentMethod !== 'COD' && order.paymentMethod !== 'Cash on Delivery';
      const codAmount = isPrepaid ? 0 : (order.totalPrice || 0);

      const resData = await this.request('/create_order', credentials, {
        method: 'POST',
        body: JSON.stringify({
          invoice: order.id,
          recipient_name: order.customerName,
          recipient_phone: order.phone,
          recipient_address: `${order.address}${order.district ? `, ${order.district}` : ''}`,
          cod_amount: codAmount,
          note: order.productTitle || 'Savaria BD Parcel'
        })
      });

      if (Number(resData.status) === 200 && resData.consignment?.tracking_code) {
        const trackingCode = String(resData.consignment.tracking_code);
        return {
          success: true,
          consignmentId: trackingCode,
          trackingCode,
          message: 'Steadfast কুরিয়ারে সফলভাবে পার্সেল এন্ট্রি করা হয়েছে!'
        };
      }

      throw new Error(resData.message || 'Steadfast did not return a tracking code');
    } catch (error: any) {
      console.error('Steadfast API error:', error);
      throw new Error(error?.message || 'Steadfast courier dispatch failed');
    }
  }

  static async getStatus(trackingCode: string, customCreds?: SteadfastCredentials) {
    if (!/^[A-Za-z0-9_-]{4,80}$/.test(trackingCode)) {
      throw new Error('Invalid Steadfast tracking code');
    }
    const data = await this.request(`/status_by_trackingcode/${encodeURIComponent(trackingCode)}`, customCreds);
    if (Number(data.status) !== 200 || !data.delivery_status) {
      throw new Error(data.message || 'Courier status unavailable');
    }
    return { success: true, status: String(data.delivery_status) };
  }
}
