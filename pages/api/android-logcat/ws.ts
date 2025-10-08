import type { NextApiRequest, NextApiResponse } from 'next'
import type { Server as HTTPServer } from 'http'
import { Server as IOServer } from 'socket.io'
import { androidLogcatManager } from '@/lib/server/androidLogcatManager'

type SocketIOServer = IOServer

type ServerWithIO = HTTPServer & {
    io?: SocketIOServer
}

type NextApiResponseWithSocket = NextApiResponse & {
    socket: NextApiResponse['socket'] & {
        server: ServerWithIO
    }
}

export const config = {
    api: {
        bodyParser: false
    }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const response = res as NextApiResponseWithSocket
    const server = response.socket?.server

    if (!server) {
        res.status(500).end('Socket server unavailable')
        return
    }

    if (!server.io) {
        const io = new IOServer(server, {
            path: '/api/android-logcat/ws',
            transports: ['websocket'],
            cors: {
                origin: true,
                credentials: true
            }
        })

        io.on('connection', (socket) => {
            androidLogcatManager.registerSocket(socket)
        })

        server.io = io
        console.info('[LogcatSocket] Socket.IO server initialised')
    }

    res.end()
}
