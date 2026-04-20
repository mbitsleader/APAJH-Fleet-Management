import logger from '../lib/logger';
import { Request, Response } from 'express';
import prisma from '../services/prisma';

export const getPoles = async (req: Request, res: Response) => {
  try {
    // Seuls les pôles actifs sont exposés — les pôles archivés (isActive=false) sont invisibles
    const poles = await prisma.pole.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json(poles);
  } catch (error) {
    logger.error({ error }, 'Error fetching poles:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createPole = async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Le nom du pôle est obligatoire.' });
  try {
    const pole = await prisma.pole.create({ data: { name: name.trim() } });
    res.status(201).json(pole);
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Ce pôle existe déjà.' });
    logger.error({ error }, 'Error creating pole:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updatePole = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Le nom du pôle est obligatoire.' });
  try {
    const pole = await prisma.pole.update({ where: { id }, data: { name: name.trim() } });
    res.json(pole);
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Pôle introuvable.' });
    if (error.code === 'P2002') return res.status(409).json({ error: 'Ce pôle existe déjà.' });
    logger.error({ error }, 'Error updating pole:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deletePole = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.pole.delete({ where: { id } });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Pôle introuvable.' });
    logger.error({ error }, 'Error deleting pole:');
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
