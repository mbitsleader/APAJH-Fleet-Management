import logger from '../lib/logger';
import { Request, Response } from 'express';
import prisma from '../services/prisma';

export const getServices = async (req: Request, res: Response) => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { name: 'asc' },
      include: { pole: { select: { id: true, name: true } } },
    });
    res.json(services);
  } catch (error) {
    logger.error({ error }, 'Error fetching services:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createService = async (req: Request, res: Response) => {
  const { name, poleId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Le nom du service est obligatoire.' });
  try {
    const service = await prisma.service.create({
      data: { name: name.trim(), poleId: poleId || null },
      include: { pole: { select: { id: true, name: true } } },
    });
    res.status(201).json(service);
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Ce service existe déjà.' });
    logger.error({ error }, 'Error creating service:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateService = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, poleId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Le nom du service est obligatoire.' });
  try {
    const service = await prisma.service.update({
      where: { id },
      data: { name: name.trim(), ...(poleId !== undefined && { poleId: poleId || null }) },
      include: { pole: { select: { id: true, name: true } } },
    });
    res.json(service);
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Service introuvable.' });
    if (error.code === 'P2002') return res.status(409).json({ error: 'Ce service existe déjà.' });
    logger.error({ error }, 'Error updating service:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteService = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.service.delete({ where: { id } });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Service introuvable.' });
    logger.error({ error }, 'Error deleting service:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
