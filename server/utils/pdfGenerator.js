const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');


/**
 * Generate a PDF invoice for an order
 * @param {Object} order - The order object
 * @returns {Promise<Buffer>} - PDF buffer
 */
const generateInvoicePDF = async (order) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // Get the absolute path to the logo
            const logoPath = path.join(process.cwd(), 'public', 'images', 'f.logo.png');

            // Add header with logo and company info
            try {
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 50, 45, { width: 80 });
                } else {
                    console.warn('Logo file not found at:', logoPath);
                }
            } catch (logoError) {
                console.error('Error adding logo:', logoError);
                // Continue without the logo
            }

            // Company Information
            doc.fontSize(20)
               .text('N.HONEST SUPERMARKET', 150, 50, { align: 'right' })
               .fontSize(10)
               .text('Kigali City, Rwanda', 150, 75, { align: 'right' })
               .text('Tel: +250 788 633 739', 150, 90, { align: 'right' })
               .text('Email: info@nhonestsupermarket.com', 150, 105, { align: 'right' });

            // Add invoice title and details
            doc.moveDown()
               .fontSize(16)
               .text('INVOICE', 50, 150)
               .fontSize(10)
               .text(`Invoice Number: ${order.reference}`, 50, 180)
               .text(`Order Number: ${order.orderNumber}`, 50, 195)
               .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 50, 210);

            // Add customer details with full address
            doc.fontSize(12)
               .text('Bill To:', 50, 250)
               .fontSize(10)
               .text(`${order.customer.fullName}`, 50, 270)
               .text(`Email: ${order.customer.email}`, 50, 285)
               .text(`Phone: ${order.customer.phone || 'N/A'}`, 50, 300)
               .text(`Address: ${order.customer.address || 'N/A'}`, 50, 315)
               .text(`City: ${order.customer.city || 'N/A'}`, 50, 330)
               .text(`Sector: ${order.customer.sector || 'N/A'}`, 50, 345);

            // Draw items table
            const tableTop = 390;
            doc.moveTo(50, tableTop)
               .lineTo(550, tableTop)
               .stroke();

            // Table headers with background
            doc.fillColor('#f0f0f0')
               .rect(50, tableTop - 20, 500, 20)
               .fill()
               .fillColor('#000000');

            doc.fontSize(10)
               .text('Item', 50, tableTop - 15)
               .text('Qty', 280, tableTop - 15)
               .text('Price', 350, tableTop - 15)
               .text('Total', 450, tableTop - 15);

            // Table content with alternating background
            let y = tableTop + 10;
            order.items.forEach((item, index) => {
                if (index % 2 === 0) {
                    doc.fillColor('#f9f9f9')
                       .rect(50, y - 5, 500, 20)
                       .fill()
                       .fillColor('#000000');
                }

                doc.text(item.name, 50, y)
                   .text(item.quantity.toString(), 280, y)
                   .text(`RWF ${item.price.toLocaleString()}`, 350, y)
                   .text(`RWF ${(item.price * item.quantity).toLocaleString()}`, 450, y);
                y += 20;
            });

            // Draw bottom line
            doc.moveTo(50, y)
               .lineTo(550, y)
               .stroke();


            // Add totals with better formatting
            y += 20;
            doc.fontSize(10)
               .text('Subtotal:', 350, y)
               .text(`RWF ${order.subtotal.toLocaleString()}`, 450, y);
            y += 20;
            doc.text('Delivery Fee:', 350, y)
               .text(`RWF ${order.deliveryFee.toLocaleString()}`, 450, y);
            if (order.tax) {
                y += 20;
                doc.text('Tax:', 350, y)
                   .text(`RWF ${order.tax.toLocaleString()}`, 450, y);
            }
            y += 25;
            
            // Total with background highlight
            doc.fillColor('#f0f0f0')
               .rect(340, y - 5, 210, 25)
               .fill()
               .fillColor('#000000')
               .fontSize(12)
               .text('Total:', 350, y, { bold: true })
               .text(`RWF ${order.total.toLocaleString()}`, 450, y, { bold: true });

            // Add payment instructions with styled box
            doc.rect(50, y + 40, 500, 120)
               .lineWidth(1)
               .stroke()
               .fontSize(12)
               .text('Payment Instructions', 60, y + 50, { underline: true })
               .fontSize(10)
               .moveDown(0.5)
               .text('MTN Mobile Money:', 60)
               .text('1. Dial *182*8*1#', 70)
               .text('2. Enter merchant code: 430020', 70)
               .text(`3. Enter amount: RWF ${order.total.toLocaleString()}`, 70)
               .text('4. Enter your PIN to confirm', 70);

            // Add footer with line
            doc.moveTo(50, 700)
               .lineTo(550, 700)
               .stroke()
               .fontSize(8)
               .text('Thank you for shopping with N.Honest Supermarket!', 50, 710, { align: 'center' })
               .text('For any questions, please contact us at +250 788 633 739 or info@nhonestsupermarket.com', { align: 'center' });

            // Finalize the PDF
            doc.end();
        } catch (error) {
            console.error('Error generating PDF:', error);
            reject(error);
        }
    });
};

module.exports = { generateInvoicePDF };